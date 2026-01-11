import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import Stripe from "stripe";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { config } from "./config";
import { prisma } from "./db";
import { ensureSeedProduct } from "./seedProduct.js";
import { ensureDefaultShippingZone } from "./seedShipping.js";
import authRoutes from "./auth/routes";
import { requireAuth } from "./auth/middleware";
const stripe = new Stripe(config.stripeSecretKey, {
    apiVersion: "2024-06-20",
});
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const r2 = config.r2;
const useR2 = Boolean(r2?.bucket);
const uploadDir = path.join(__dirname, "..", "uploads");
if (!useR2) {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    app.use("/uploads", express.static(uploadDir));
}
const r2Client = useR2
    ? new S3Client({
        region: "auto",
        endpoint: r2.endpoint || `https://${r2.accountId}.r2.cloudflarestorage.com`,
        // IMPORTANT for Cloudflare R2: avoid virtual-hosted style requests like
        // https://<bucket>.<accountId>.r2.cloudflarestorage.com (cert mismatch).
        // Path-style keeps the host as <accountId>.r2.cloudflarestorage.com.
        forcePathStyle: true,
        credentials: {
            accessKeyId: r2.accessKeyId,
            secretAccessKey: r2.secretAccessKey,
        },
    })
    : null;
if (useR2) {
    // Serve uploaded assets from R2 via the API so the app works even with private buckets.
    // If you configure a public bucket + R2_PUBLIC_BASE_URL, the upload API will return that public URL instead.
    app.get("/uploads/*", async (req, res) => {
        const rawKey = req.params[0];
        const key = rawKey ? decodeURIComponent(rawKey) : "";
        if (!key) {
            res.status(400).send("Missing key");
            return;
        }
        // If a public bucket/domain is configured, redirect to it so browsers fetch directly.
        // This avoids requiring server-to-R2 connectivity for serving assets.
        const base = (r2.publicBaseUrl || "").replace(/\/$/, "");
        if (base) {
            const encodedKey = key
                .split("/")
                .map((s) => encodeURIComponent(s))
                .join("/");
            res.redirect(302, `${base}/${encodedKey}`);
            return;
        }
        try {
            const out = await r2Client.send(new GetObjectCommand({
                Bucket: r2.bucket,
                Key: key,
            }));
            if (out.ContentType)
                res.setHeader("Content-Type", out.ContentType);
            if (out.ETag)
                res.setHeader("ETag", out.ETag);
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            const body = out.Body;
            if (!body) {
                res.status(404).send("Not found");
                return;
            }
            // Body is a readable stream in Node
            body.pipe(res);
        }
        catch (err) {
            const name = String(err?.name || "");
            const code = String(err?.code || "");
            const httpCode = err?.$metadata?.httpStatusCode;
            if (name === "NoSuchKey" || httpCode === 404) {
                res.status(404).send("Not found");
                return;
            }
            // If R2 is unreachable (DNS/TLS/network), report 502 so it's clear this is upstream.
            const looksLikeConnectivityIssue = ["EPROTO", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code) ||
                name === "TimeoutError";
            console.error("R2 getObject error:", err);
            res
                .status(looksLikeConnectivityIssue ? 502 : 500)
                .send("Failed to fetch asset");
        }
    });
}
const upload = multer({
    storage: useR2
        ? multer.memoryStorage()
        : multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, uploadDir),
            filename: (_req, file, cb) => {
                const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
                const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
                    ? ext
                    : ".bin";
                const rand = Math.random().toString(16).slice(2);
                cb(null, `${Date.now()}-${rand}${safeExt}`);
            },
        }),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (_req, file, cb) => {
        const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
        if (!ok) {
            cb(new Error("Only image uploads are allowed"));
        }
        else {
            cb(null, true);
        }
    },
});
// CORS (allow your Vite dev server)
app.use(cors({
    origin: config.clientUrl,
    credentials: true, // Enable cookies
}));
app.use(cookieParser());
// Admin auth: server sessions stored in Postgres.
const PgSession = connectPgSimple(session);
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
app.use(session({
    name: "redember.sid",
    secret: config.sessionSecret || config.jwtSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true,
    }),
}));
// IMPORTANT: Webhook must use raw body BEFORE express.json()
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        res.status(400).send(`Webhook Error: ${errorMessage}`);
        return;
    }
    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            // Idempotency requirement: if order with stripeSessionId exists, do nothing.
            const existing = await prisma.order.findUnique({
                where: { stripeSessionId: session.id },
            });
            if (existing) {
                res.json({ received: true });
                return;
            }
            if (session.payment_status !== "paid") {
                res.json({ received: true });
                return;
            }
            let cartItems = null;
            const rawCart = session.metadata?.items;
            if (rawCart) {
                try {
                    const parsed = JSON.parse(rawCart);
                    if (Array.isArray(parsed)) {
                        cartItems = parsed
                            .filter((i) => i && typeof i.productId === "string")
                            .map((i) => ({
                            productId: i.productId,
                            quantity: parseInt(i.quantity || "0", 10),
                        }))
                            .filter((i) => Number.isInteger(i.quantity) && i.quantity > 0);
                        if (cartItems.length === 0)
                            cartItems = null;
                    }
                }
                catch {
                    cartItems = null;
                }
            }
            // Backwards-compatible single-product metadata
            const productId = session.metadata?.productId;
            const sku = session.metadata?.sku;
            const metadataQty = parseInt(session.metadata?.quantity || "0", 10);
            if (!cartItems) {
                if (!productId ||
                    !sku ||
                    !Number.isInteger(metadataQty) ||
                    metadataQty <= 0) {
                    // Store nothing if metadata is missing; in a real app you'd alert.
                    res.status(400).json({ error: "Missing required metadata" });
                    return;
                }
                cartItems = [{ productId, quantity: metadataQty }];
            }
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
                limit: 10,
            });
            const purchasedQty = lineItems.data.reduce((sum, li) => sum + (li.quantity || 0), 0);
            // Prefer Stripe total quantity when dealing with a single item.
            const primaryItem = cartItems[0];
            const primaryQuantity = cartItems.length === 1
                ? purchasedQty || primaryItem.quantity
                : primaryItem.quantity;
            const customerEmail = session.customer_details?.email || null;
            const customerPhone = session.customer_details?.phone || null;
            const shipping = session.shipping_details || null;
            const address = shipping?.address || null;
            const itemsJson = JSON.stringify(lineItems.data.map((li) => ({
                description: li.description,
                quantity: li.quantity,
                amountSubtotal: li.amount_subtotal,
                amountTotal: li.amount_total,
                currency: li.currency,
            })), null, 0);
            // Decrement stock safely (won't go negative) + create order.
            // Note: There is still an MVP oversell risk under heavy concurrency.
            await prisma.$transaction(async (tx) => {
                for (const item of cartItems) {
                    const updated = await tx.product.updateMany({
                        where: {
                            id: item.productId,
                            stock: { gte: item.quantity },
                        },
                        data: {
                            stock: { decrement: item.quantity },
                        },
                    });
                    if (updated.count !== 1) {
                        throw new Error(`Insufficient stock for ${item.productId}`);
                    }
                }
                const primaryProduct = await tx.product.findUnique({
                    where: { id: primaryItem.productId },
                });
                await tx.order.create({
                    data: {
                        stripeSessionId: session.id,
                        paymentIntentId: typeof session.payment_intent === "string"
                            ? session.payment_intent
                            : session.payment_intent?.toString() || null,
                        status: "PAID",
                        productId: primaryItem.productId,
                        sku: primaryProduct?.sku || "UNKNOWN",
                        quantity: primaryQuantity,
                        email: customerEmail,
                        phone: customerPhone,
                        shippingName: shipping?.name || null,
                        shippingLine1: address?.line1 || null,
                        shippingLine2: address?.line2 || null,
                        shippingCity: address?.city || null,
                        shippingState: address?.state || null,
                        shippingPostal: address?.postal_code || null,
                        shippingCountry: address?.country || null,
                        amountTotal: session.amount_total || 0,
                        currency: session.currency || "usd",
                        itemsJson,
                    },
                });
            });
        }
        res.json({ received: true });
        return;
    }
    catch (err) {
        console.error("Webhook handler error:", err);
        res.status(500).json({ error: "Webhook handler failed" });
        return;
    }
});
app.use(express.json());
// Auth routes
app.use("/api/auth", authRoutes);
app.get("/api/health", (_req, res) => {
    res.json({
        ok: true,
        r2: useR2
            ? {
                enabled: true,
                bucket: r2.bucket,
                publicBaseUrl: r2.publicBaseUrl || null,
                endpoint: r2.endpoint || `https://${r2.accountId}.r2.cloudflarestorage.com`,
            }
            : { enabled: false },
    });
});
function serializeProduct(product) {
    return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        priceCents: product.priceCents,
        currency: product.currency,
        stock: product.stock,
        description: product.description || null,
        imageUrl: product.imageUrl || null,
        groupId: product.groupId || null,
        variantName: product.variantName || null,
        requiresShipping: product.requiresShipping,
        weightGrams: product.weightGrams || null,
        weightOz: product.weightOz || null,
        weightG: product.weightG || null,
        volumeMl: product.volumeMl || null,
        lengthMm: product.lengthMm || null,
        widthMm: product.widthMm || null,
        heightMm: product.heightMm || null,
        active: product.active,
    };
}
// A) Products endpoints
app.get("/api/products", async (_req, res) => {
    const products = await prisma.product.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
    });
    res.json(products.map(serializeProduct));
});
app.get("/api/products/:id", async (req, res) => {
    const id = req.params.id;
    const product = await prisma.product.findFirst({
        where: { id, active: true },
    });
    if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
    }
    res.json(serializeProduct(product));
});
// Legacy featured-product endpoint (kept for compatibility)
app.get("/api/product", async (_req, res) => {
    const featured = await prisma.product.findFirst({
        where: { id: "red-ember-spice", active: true },
    });
    const fallback = featured ||
        (await prisma.product.findFirst({
            where: { active: true },
            orderBy: { createdAt: "asc" },
        }));
    if (!fallback) {
        res.status(404).json({ error: "Product not found" });
        return;
    }
    res.json(serializeProduct(fallback));
});
// B) Checkout session creation
app.post("/api/checkout", async (req, res) => {
    try {
        const productId = req.body?.productId || "red-ember-spice";
        const quantity = req.body?.quantity;
        if (typeof productId !== "string" || productId.trim().length === 0) {
            res.status(400).json({ error: "productId is required" });
            return;
        }
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
            res
                .status(400)
                .json({ error: "Quantity must be an integer from 1 to 10" });
            return;
        }
        const product = await prisma.product.findFirst({
            where: { id: productId, active: true },
        });
        if (!product) {
            res.status(404).json({ error: "Product not found" });
            return;
        }
        if (quantity > product.stock) {
            res.status(400).json({ error: `Only ${product.stock} left` });
            return;
        }
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [
                {
                    price_data: {
                        currency: product.currency,
                        unit_amount: product.priceCents,
                        product_data: {
                            name: product.name,
                        },
                    },
                    quantity,
                },
            ],
            shipping_address_collection: {
                allowed_countries: ["US"],
            },
            phone_number_collection: {
                enabled: true,
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: "fixed_amount",
                        fixed_amount: { amount: 499, currency: product.currency },
                        display_name: "Standard",
                        delivery_estimate: {
                            minimum: { unit: "business_day", value: 3 },
                            maximum: { unit: "business_day", value: 5 },
                        },
                    },
                },
                {
                    shipping_rate_data: {
                        type: "fixed_amount",
                        fixed_amount: { amount: 1299, currency: product.currency },
                        display_name: "Express",
                        delivery_estimate: {
                            minimum: { unit: "business_day", value: 1 },
                            maximum: { unit: "business_day", value: 2 },
                        },
                    },
                },
            ],
            success_url: `${config.clientUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.clientUrl}/cancel`,
            metadata: {
                productId: product.id,
                sku: product.sku,
                quantity: quantity.toString(),
            },
        });
        res.json({ url: session.url });
        return;
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create checkout session" });
        return;
    }
});
// C) Cart checkout session creation (multiple line items)
app.post("/api/checkout/cart", async (req, res) => {
    try {
        const itemsRaw = req.body?.items;
        if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
            res.status(400).json({ error: "items must be a non-empty array" });
            return;
        }
        // Normalize + combine duplicates
        const combined = new Map();
        for (const item of itemsRaw) {
            const productId = item?.productId;
            const qty = item?.quantity;
            if (typeof productId !== "string" || productId.trim().length === 0) {
                res.status(400).json({ error: "Each item needs a productId" });
                return;
            }
            if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
                res.status(400).json({
                    error: "Each item quantity must be an integer from 1 to 10",
                });
                return;
            }
            combined.set(productId, (combined.get(productId) || 0) + qty);
        }
        const items = Array.from(combined.entries()).map(([productId, quantity]) => ({
            productId,
            quantity,
        }));
        const ids = items.map((i) => i.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: ids }, active: true },
        });
        const productById = new Map(products.map((p) => [p.id, p]));
        for (const item of items) {
            const p = productById.get(item.productId);
            if (!p) {
                res
                    .status(404)
                    .json({ error: `Product not found: ${item.productId}` });
                return;
            }
            if (item.quantity > p.stock) {
                res.status(400).json({ error: `Only ${p.stock} left of ${p.name}` });
                return;
            }
        }
        const currencies = new Set(products.map((p) => p.currency));
        if (currencies.size > 1) {
            res
                .status(400)
                .json({ error: "All cart items must have the same currency" });
            return;
        }
        const currency = products[0]?.currency || "usd";
        const line_items = items.map((i) => {
            const p = productById.get(i.productId);
            return {
                price_data: {
                    currency: p.currency,
                    unit_amount: p.priceCents,
                    product_data: {
                        name: p.name,
                    },
                },
                quantity: i.quantity,
            };
        });
        const primary = items[0];
        const primaryProduct = productById.get(primary.productId);
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items,
            shipping_address_collection: {
                allowed_countries: ["US"],
            },
            phone_number_collection: {
                enabled: true,
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: "fixed_amount",
                        fixed_amount: { amount: 499, currency },
                        display_name: "Standard",
                        delivery_estimate: {
                            minimum: { unit: "business_day", value: 3 },
                            maximum: { unit: "business_day", value: 5 },
                        },
                    },
                },
                {
                    shipping_rate_data: {
                        type: "fixed_amount",
                        fixed_amount: { amount: 1299, currency },
                        display_name: "Express",
                        delivery_estimate: {
                            minimum: { unit: "business_day", value: 1 },
                            maximum: { unit: "business_day", value: 2 },
                        },
                    },
                },
            ],
            success_url: `${config.clientUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.clientUrl}/cancel`,
            metadata: {
                // Backwards compatibility fields
                productId: primary.productId,
                sku: primaryProduct?.sku || "UNKNOWN",
                quantity: primary.quantity.toString(),
                // Cart payload
                items: JSON.stringify(items),
            },
        });
        res.json({ url: session.url });
        return;
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create checkout session" });
        return;
    }
});
// D) Admin endpoints (token protected)
app.get("/api/admin/inventory", requireAuth, async (_req, res) => {
    const products = await prisma.product.findMany({
        orderBy: { createdAt: "asc" },
    });
    res.json(products.map((p) => ({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        variantName: p.variantName || null,
        groupId: p.groupId || null,
        priceCents: p.priceCents,
        currency: p.currency,
        stock: p.stock,
        active: p.active,
        imageUrl: p.imageUrl || null,
        shipping: {
            requiresShipping: p.requiresShipping,
            weightGrams: p.weightGrams || null,
            lengthMm: p.lengthMm || null,
            widthMm: p.widthMm || null,
            heightMm: p.heightMm || null,
        },
    })));
});
// Admin: product groups
app.get("/api/admin/groups", requireAuth, async (_req, res) => {
    const groups = await prisma.productGroup.findMany({
        orderBy: { createdAt: "asc" },
    });
    res.json(groups);
});
app.post("/api/admin/groups", requireAuth, async (req, res) => {
    const name = (req.body?.name || "").trim();
    const handle = (req.body?.handle || "").trim();
    const description = (req.body?.description || "").trim() || null;
    if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
    }
    if (!handle) {
        res.status(400).json({ error: "handle is required" });
        return;
    }
    const created = await prisma.productGroup.create({
        data: {
            name,
            handle,
            description,
            active: true,
        },
    });
    res.status(201).json(created);
});
app.put("/api/admin/groups/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const name = (req.body?.name || "").trim();
    const handle = (req.body?.handle || "").trim();
    const description = (req.body?.description || "").trim() || null;
    const active = typeof req.body?.active === "boolean" ? req.body.active : undefined;
    if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
    }
    if (!handle) {
        res.status(400).json({ error: "handle is required" });
        return;
    }
    const updated = await prisma.productGroup.update({
        where: { id },
        data: {
            name,
            handle,
            description,
            ...(active === undefined ? {} : { active }),
        },
    });
    res.json(updated);
});
app.delete("/api/admin/groups/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    // prevent deleting if it still has products
    const count = await prisma.product.count({ where: { groupId: id } });
    if (count > 0) {
        res
            .status(400)
            .json({ error: "Cannot delete group with existing variants" });
        return;
    }
    await prisma.productGroup.delete({ where: { id } });
    res.json({ ok: true });
});
// Admin: variants (Products)
app.get("/api/admin/products", requireAuth, async (_req, res) => {
    const products = await prisma.product.findMany({
        orderBy: { createdAt: "asc" },
    });
    res.json(products.map(serializeProduct));
});
app.post("/api/admin/products", requireAuth, async (req, res) => {
    const body = req.body || {};
    const id = (body.id || "").trim();
    const name = (body.name || "").trim();
    const sku = (body.sku || "").trim();
    const currency = (body.currency || "usd").trim().toLowerCase();
    const priceCents = Number(body.priceCents);
    const stock = Number(body.stock);
    if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
    }
    if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
    }
    if (!sku) {
        res.status(400).json({ error: "sku is required" });
        return;
    }
    if (!Number.isInteger(priceCents) || priceCents < 0) {
        res.status(400).json({ error: "priceCents must be an integer >= 0" });
        return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
        res.status(400).json({ error: "stock must be an integer >= 0" });
        return;
    }
    const created = await prisma.product.create({
        data: {
            id,
            name,
            sku,
            currency,
            priceCents,
            stock,
            description: typeof body.description === "string" ? body.description : null,
            imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
            groupId: typeof body.groupId === "string" ? body.groupId : null,
            variantName: typeof body.variantName === "string" ? body.variantName : null,
            requiresShipping: typeof body.requiresShipping === "boolean"
                ? body.requiresShipping
                : true,
            weightGrams: Number.isInteger(body.weightGrams)
                ? body.weightGrams
                : null,
            lengthMm: Number.isInteger(body.lengthMm) ? body.lengthMm : null,
            widthMm: Number.isInteger(body.widthMm) ? body.widthMm : null,
            heightMm: Number.isInteger(body.heightMm) ? body.heightMm : null,
            active: typeof body.active === "boolean" ? body.active : true,
        },
    });
    res.status(201).json(serializeProduct(created));
});
app.put("/api/admin/products/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const body = req.body || {};
    const data = {};
    if (typeof body.name === "string")
        data.name = body.name.trim();
    if (typeof body.sku === "string")
        data.sku = body.sku.trim();
    if (typeof body.currency === "string")
        data.currency = body.currency.trim().toLowerCase();
    if (typeof body.description === "string")
        data.description = body.description;
    if (typeof body.imageUrl === "string")
        data.imageUrl = body.imageUrl;
    if (typeof body.groupId === "string")
        data.groupId = body.groupId;
    if (body.groupId === null)
        data.groupId = null;
    if (typeof body.variantName === "string")
        data.variantName = body.variantName;
    if (body.variantName === null)
        data.variantName = null;
    if (typeof body.active === "boolean")
        data.active = body.active;
    if (typeof body.requiresShipping === "boolean")
        data.requiresShipping = body.requiresShipping;
    if (body.priceCents !== undefined) {
        const v = Number(body.priceCents);
        if (!Number.isInteger(v) || v < 0) {
            res.status(400).json({ error: "priceCents must be an integer >= 0" });
            return;
        }
        data.priceCents = v;
    }
    if (body.stock !== undefined) {
        const v = Number(body.stock);
        if (!Number.isInteger(v) || v < 0) {
            res.status(400).json({ error: "stock must be an integer >= 0" });
            return;
        }
        data.stock = v;
    }
    for (const key of ["weightGrams", "lengthMm", "widthMm", "heightMm"]) {
        if (body[key] === null) {
            data[key] = null;
        }
        else if (body[key] !== undefined) {
            const v = Number(body[key]);
            if (!Number.isInteger(v) || v < 0) {
                res.status(400).json({ error: `${key} must be an integer >= 0` });
                return;
            }
            data[key] = v;
        }
    }
    const updated = await prisma.product.update({ where: { id }, data });
    res.json(serializeProduct(updated));
});
app.delete("/api/admin/products/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const orderCount = await prisma.order.count({ where: { productId: id } });
    if (orderCount > 0) {
        res
            .status(400)
            .json({ error: "Cannot delete a product that has orders" });
        return;
    }
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
});
// Admin: upload an image and get back a URL usable in imageUrl
app.post("/api/admin/upload", requireAuth, upload.single("file"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "file is required" });
        return;
    }
    if (!useR2) {
        // clientUrl is used for CORS + redirects; the API is served from server origin.
        // Return a relative URL so it works in dev/prod without hardcoding hosts.
        res.status(201).json({ url: `/uploads/${req.file.filename}` });
        return;
    }
    // Upload to R2
    const ext = path.extname(req.file.originalname || "").toLowerCase() || ".bin";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
        ? ext
        : ".bin";
    const key = `product-images/${Date.now()}-${randomUUID()}${safeExt}`;
    try {
        await r2Client.send(new PutObjectCommand({
            Bucket: r2.bucket,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            CacheControl: "public, max-age=31536000, immutable",
        }));
        // If you configured a public bucket/domain, prefer returning a public URL.
        const base = (r2.publicBaseUrl || "").replace(/\/$/, "");
        if (base) {
            res.status(201).json({ url: `${base}/${key}` });
            return;
        }
        // Otherwise return our proxy URL (works with private buckets).
        res.status(201).json({ url: `/uploads/${encodeURIComponent(key)}` });
    }
    catch (err) {
        const name = String(err?.name || "");
        const code = String(err?.code || "");
        const looksLikeConnectivityIssue = ["EPROTO", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code) ||
            name === "TimeoutError";
        console.error("R2 putObject error:", err);
        res
            .status(looksLikeConnectivityIssue ? 502 : 500)
            .json({ error: "Upload failed" });
    }
});
function safeParseItemsJson(itemsJson) {
    try {
        const parsed = JSON.parse(itemsJson || "[]");
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function adminOrderDto(o) {
    const rawItems = safeParseItemsJson(String(o.itemsJson || "[]"));
    const items = rawItems
        .map((it, idx) => {
        const qty = Math.max(1, Number(it?.quantity) || 1);
        const lineTotal = Number(it?.amountSubtotal ?? it?.amountTotal ?? 0) || 0;
        const unit = Math.round(lineTotal / qty);
        const name = String(it?.description || "Item");
        const productId = String(it?.productId || it?.sku || name);
        return {
            id: `${o.id}_${idx}`,
            orderId: o.id,
            productId,
            productName: name,
            quantity: qty,
            priceCents: unit,
        };
    })
        .filter((it) => it.quantity > 0);
    // Fallback for legacy/broken itemsJson
    const fallbackItems = items.length > 0
        ? items
        : [
            {
                id: `${o.id}_0`,
                orderId: o.id,
                productId: o.productId,
                productName: o.product?.name || null,
                quantity: o.quantity,
                priceCents: o.product?.priceCents || 0,
            },
        ];
    return {
        id: o.id,
        stripeSessionId: o.stripeSessionId,
        status: o.status,
        createdAt: o.createdAt,
        email: o.email,
        customerEmail: o.email,
        customerName: o.shippingName,
        phone: o.phone,
        shipping: {
            name: o.shippingName,
            city: o.shippingCity,
            state: o.shippingState,
            postal: o.shippingPostal,
            country: o.shippingCountry,
        },
        total: o.amountTotal,
        totalCents: o.amountTotal,
        currency: o.currency,
        itemsJson: o.itemsJson,
        items: fallbackItems,
    };
}
async function calculateShippingInternal(params) {
    const { items, country } = params;
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalWeightG = 0;
    for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product)
            continue;
        const qty = Number(item.quantity) || 1;
        let weightG = 0;
        if (product.weightG) {
            weightG = product.weightG;
        }
        else if (product.weightOz) {
            weightG = product.weightOz * 28.3495;
        }
        else if (product.weightGrams) {
            weightG = product.weightGrams;
        }
        else if (product.volumeMl) {
            weightG = product.volumeMl;
        }
        totalWeightG += weightG * qty;
    }
    if (totalWeightG === 0) {
        totalWeightG = 250;
    }
    const targetCountry = (country || "US").toUpperCase();
    const zone = await prisma.shippingZone.findFirst({
        where: {
            enabled: true,
            countries: { has: targetCountry },
        },
        include: {
            weightTiers: {
                orderBy: { minWeightG: "asc" },
            },
        },
    });
    let shippingCents = 0;
    let freeShippingMin = null;
    let zoneName = "Default";
    if (zone) {
        zoneName = zone.name;
        freeShippingMin = zone.freeShippingMin;
        const tier = zone.weightTiers.find((t) => totalWeightG >= t.minWeightG && totalWeightG <= t.maxWeightG);
        if (tier) {
            shippingCents = tier.rateCents;
        }
        else {
            const maxTier = zone.weightTiers[zone.weightTiers.length - 1];
            shippingCents = maxTier?.rateCents || 0;
        }
    }
    else {
        if (totalWeightG <= 250) {
            shippingCents = 450;
        }
        else if (totalWeightG <= 750) {
            shippingCents = 875;
        }
        else {
            shippingCents = 1200;
        }
        freeShippingMin = 7500;
    }
    return {
        shippingCents,
        totalWeightG: Math.round(totalWeightG),
        freeShippingMin,
        zoneName,
    };
}
app.get("/api/admin/orders", requireAuth, async (_req, res) => {
    const orders = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: { product: true },
    });
    res.json(orders.map(adminOrderDto));
});
app.post("/api/admin/orders/manual", requireAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const itemsRaw = body.items;
        if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
            res.status(400).json({ error: "items array is required" });
            return;
        }
        const items = itemsRaw
            .map((i) => ({
            productId: String(i?.productId || "").trim(),
            quantity: parseInt(String(i?.quantity || "0"), 10),
        }))
            .filter((i) => i.productId && Number.isInteger(i.quantity) && i.quantity > 0);
        if (items.length === 0) {
            res
                .status(400)
                .json({ error: "items must include productId and quantity > 0" });
            return;
        }
        const customerEmail = String(body.customer?.email || "").trim();
        const customerName = String(body.customer?.name || "").trim();
        const customerPhone = String(body.customer?.phone || "").trim();
        if (!customerEmail) {
            res.status(400).json({ error: "customer.email is required" });
            return;
        }
        const productIds = Array.from(new Set(items.map((i) => i.productId)));
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        if (products.length !== productIds.length) {
            res.status(400).json({ error: "One or more products not found" });
            return;
        }
        const currency = (products[0]?.currency || "usd").toLowerCase();
        if (products.some((p) => (p.currency || "usd").toLowerCase() !== currency)) {
            res
                .status(400)
                .json({ error: "All items must have the same currency" });
            return;
        }
        const requiresShipping = products.some((p) => p.requiresShipping);
        const addr = body.shippingAddress || {};
        const country = String(addr.country || "US")
            .trim()
            .toUpperCase() || "US";
        const shippingLine1 = String(addr.line1 || "").trim();
        const shippingLine2 = String(addr.line2 || "").trim();
        const shippingCity = String(addr.city || "").trim();
        const shippingState = String(addr.state || "").trim();
        const shippingPostal = String(addr.postal || "").trim();
        if (requiresShipping) {
            if (!shippingLine1 ||
                !shippingCity ||
                !shippingState ||
                !shippingPostal ||
                !country) {
                res.status(400).json({
                    error: "shippingAddress is required for shippable items (line1, city, state, postal, country)",
                });
                return;
            }
        }
        let subtotalCents = 0;
        for (const it of items) {
            const p = productMap.get(it.productId);
            subtotalCents += (p.priceCents || 0) * it.quantity;
        }
        let shippingCents = 0;
        let freeShippingMin = null;
        const overrideShipping = body.shippingCents;
        if (!requiresShipping) {
            shippingCents = 0;
        }
        else if (overrideShipping !== undefined &&
            overrideShipping !== null &&
            overrideShipping !== "") {
            const v = Number(overrideShipping);
            if (!Number.isFinite(v) || v < 0) {
                res
                    .status(400)
                    .json({ error: "shippingCents must be a number >= 0" });
                return;
            }
            shippingCents = Math.round(v);
        }
        else {
            const calc = await calculateShippingInternal({ items, country });
            shippingCents = calc.shippingCents;
            freeShippingMin = calc.freeShippingMin;
        }
        if (freeShippingMin && subtotalCents >= freeShippingMin) {
            shippingCents = 0;
        }
        const amountTotal = subtotalCents + shippingCents;
        const status = String(body.status || "pending").trim();
        const primaryItem = items[0];
        const primaryProduct = productMap.get(primaryItem.productId);
        const itemsJson = JSON.stringify(items.map((it) => {
            const p = productMap.get(it.productId);
            const lineTotal = (p.priceCents || 0) * it.quantity;
            return {
                productId: p.id,
                sku: p.sku,
                description: p.name,
                quantity: it.quantity,
                amountSubtotal: lineTotal,
                amountTotal: lineTotal,
                currency,
            };
        }), null, 0);
        const created = await prisma.$transaction(async (tx) => {
            for (const it of items) {
                const updated = await tx.product.updateMany({
                    where: { id: it.productId, stock: { gte: it.quantity } },
                    data: { stock: { decrement: it.quantity } },
                });
                if (updated.count !== 1) {
                    throw new Error(`Insufficient stock for ${it.productId}`);
                }
            }
            return await tx.order.create({
                data: {
                    stripeSessionId: `manual_${randomUUID()}`,
                    paymentIntentId: null,
                    status,
                    productId: primaryItem.productId,
                    sku: primaryProduct.sku || "UNKNOWN",
                    quantity: primaryItem.quantity,
                    email: customerEmail,
                    phone: customerPhone || null,
                    shippingName: customerName || null,
                    shippingLine1: requiresShipping ? shippingLine1 : null,
                    shippingLine2: requiresShipping ? shippingLine2 || null : null,
                    shippingCity: requiresShipping ? shippingCity : null,
                    shippingState: requiresShipping ? shippingState : null,
                    shippingPostal: requiresShipping ? shippingPostal : null,
                    shippingCountry: requiresShipping ? country : null,
                    amountTotal,
                    currency,
                    itemsJson,
                },
                include: { product: true },
            });
        });
        res.status(201).json(adminOrderDto(created));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create manual order";
        res.status(500).json({ error: msg });
    }
});
app.get("/api/admin/customers", requireAuth, async (_req, res) => {
    const groups = await prisma.order.groupBy({
        by: ["email"],
        where: {
            email: { not: null },
        },
        _count: { _all: true },
        _sum: { amountTotal: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
        orderBy: {
            _max: { createdAt: "desc" },
        },
    });
    const customers = groups
        .filter((g) => typeof g.email === "string" && g.email.trim().length > 0)
        .map((g) => {
        const email = g.email.trim();
        const createdAt = g._min.createdAt
            ? new Date(g._min.createdAt).toISOString()
            : new Date(0).toISOString();
        const lastOrderDate = g._max.createdAt
            ? new Date(g._max.createdAt).toISOString()
            : undefined;
        const totalOrders = g._count._all;
        const totalCents = g._sum.amountTotal || 0;
        const totalSpent = Math.round(totalCents) / 100;
        const lastMs = g._max.createdAt
            ? new Date(g._max.createdAt).getTime()
            : 0;
        const inactiveCutoffMs = Date.now() - 180 * 24 * 60 * 60 * 1000;
        const status = lastMs >= inactiveCutoffMs ? "active" : "inactive";
        return {
            id: email,
            name: email,
            email,
            totalOrders,
            totalSpent,
            createdAt,
            lastOrderDate,
            status,
        };
    });
    res.json(customers);
});
// Public: Calculate shipping cost for cart
app.post("/api/shipping/calculate", async (req, res) => {
    try {
        const { items, country } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: "Items array is required" });
            return;
        }
        // Get all products
        const productIds = items.map((i) => i.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        // Calculate total weight in grams
        let totalWeightG = 0;
        for (const item of items) {
            const product = productMap.get(item.productId);
            if (!product)
                continue;
            const qty = parseInt(item.quantity) || 1;
            // Use the most precise weight available
            let weightG = 0;
            if (product.weightG) {
                weightG = product.weightG;
            }
            else if (product.weightOz) {
                weightG = product.weightOz * 28.3495; // oz to grams
            }
            else if (product.weightGrams) {
                weightG = product.weightGrams;
            }
            else if (product.volumeMl) {
                // For liquids, assume 1ml ≈ 1g (works for water-based products)
                weightG = product.volumeMl;
            }
            totalWeightG += weightG * qty;
        }
        // If no weight data, use default estimate
        if (totalWeightG === 0) {
            totalWeightG = 250; // 250g default per item
        }
        // Get shipping zone (default to US if not specified)
        const targetCountry = country || "US";
        const zone = await prisma.shippingZone.findFirst({
            where: {
                enabled: true,
                countries: { has: targetCountry },
            },
            include: {
                weightTiers: {
                    orderBy: { minWeightG: "asc" },
                },
            },
        });
        // If no zone found, try default US zone or create fallback
        let shippingCents = 0;
        let freeShippingMin = null;
        if (zone) {
            freeShippingMin = zone.freeShippingMin;
            // Find matching weight tier
            const tier = zone.weightTiers.find((t) => totalWeightG >= t.minWeightG && totalWeightG <= t.maxWeightG);
            if (tier) {
                shippingCents = tier.rateCents;
            }
            else {
                // Use highest tier if over max weight
                const maxTier = zone.weightTiers[zone.weightTiers.length - 1];
                shippingCents = maxTier?.rateCents || 0;
            }
        }
        else {
            // Fallback calculation if no zone configured
            if (totalWeightG <= 250) {
                shippingCents = 450; // $4.50
            }
            else if (totalWeightG <= 750) {
                shippingCents = 875; // $8.75
            }
            else {
                shippingCents = 1200; // $12.00
            }
            freeShippingMin = 7500; // $75
        }
        res.json({
            shippingCents,
            totalWeightG: Math.round(totalWeightG),
            freeShippingMin,
            zone: zone?.name || "Default",
        });
    }
    catch (error) {
        console.error("Shipping calculation error:", error);
        res.status(500).json({ error: "Failed to calculate shipping" });
    }
});
// Admin: Get shipping configuration
app.get("/api/admin/shipping", requireAuth, async (_req, res) => {
    try {
        const zones = await prisma.shippingZone.findMany({
            include: {
                weightTiers: {
                    orderBy: { minWeightG: "asc" },
                },
            },
            orderBy: { name: "asc" },
        });
        res.json({ zones });
    }
    catch (error) {
        console.error("Get shipping config error:", error);
        res.status(500).json({ error: "Failed to get shipping configuration" });
    }
});
// Admin: Update shipping zone
app.put("/api/admin/shipping/zones/:id", requireAuth, async (req, res) => {
    try {
        const { id: rawId } = req.params;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;
        const { name, countries, enabled, freeShippingMin, weightTiers } = req.body;
        // Update zone
        await prisma.shippingZone.update({
            where: { id },
            data: {
                name,
                countries,
                enabled,
                freeShippingMin: freeShippingMin || null,
            },
        });
        // Update weight tiers if provided
        if (Array.isArray(weightTiers)) {
            // Delete existing tiers
            await prisma.weightTier.deleteMany({
                where: { zoneId: id },
            });
            // Create new tiers
            await prisma.weightTier.createMany({
                data: weightTiers.map((tier) => ({
                    zoneId: id,
                    minWeightG: tier.minWeightG,
                    maxWeightG: tier.maxWeightG,
                    rateCents: tier.rateCents,
                })),
            });
        }
        // Return updated zone with tiers
        const updated = await prisma.shippingZone.findUnique({
            where: { id },
            include: {
                weightTiers: {
                    orderBy: { minWeightG: "asc" },
                },
            },
        });
        res.json(updated);
    }
    catch (error) {
        console.error("Update shipping zone error:", error);
        res.status(500).json({ error: "Failed to update shipping zone" });
    }
});
// Admin: Create shipping zone
app.post("/api/admin/shipping/zones", requireAuth, async (req, res) => {
    try {
        const { name, countries, enabled, freeShippingMin, weightTiers } = req.body;
        const zone = await prisma.shippingZone.create({
            data: {
                name,
                countries: countries || [],
                enabled: enabled ?? true,
                freeShippingMin: freeShippingMin || null,
                weightTiers: {
                    create: (weightTiers || []).map((tier) => ({
                        minWeightG: tier.minWeightG,
                        maxWeightG: tier.maxWeightG,
                        rateCents: tier.rateCents,
                    })),
                },
            },
            include: {
                weightTiers: {
                    orderBy: { minWeightG: "asc" },
                },
            },
        });
        res.status(201).json(zone);
    }
    catch (error) {
        console.error("Create shipping zone error:", error);
        res.status(500).json({ error: "Failed to create shipping zone" });
    }
});
// Central error handler (must be after routes)
app.use((err, _req, res, next) => {
    if (!err) {
        next();
        return;
    }
    const message = err?.message || "Request failed";
    // Multer validation errors should be 400s.
    if (message.toLowerCase().includes("only image") ||
        message.toLowerCase().includes("file")) {
        res.status(400).json({ error: message });
        return;
    }
    console.error("Unhandled server error:", err);
    res.status(500).json({ error: "Server error" });
});
async function start() {
    await ensureSeedProduct();
    await ensureDefaultShippingZone();
    app.listen(config.port, () => {
        console.log(`Server listening on http://localhost:${config.port}`);
    });
}
start().catch((e) => {
    console.error("Failed to start server:", e);
    process.exit(1);
});
