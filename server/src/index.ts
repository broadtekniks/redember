import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import Stripe from "stripe";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

import type { Prisma } from "@prisma/client";

import { config } from "./config";
import { prisma } from "./db";
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

const r2S3Endpoint = useR2
  ? `https://${r2!.accountId}.r2.cloudflarestorage.com`
  : null;

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
      endpoint: r2S3Endpoint!,
      credentials: {
        accessKeyId: r2!.accessKeyId,
        secretAccessKey: r2!.secretAccessKey,
      },
    })
  : null;

if (useR2) {
  // Serve uploaded assets from R2 via the API so the app works even with private buckets.
  // If you configure a public bucket + R2_PUBLIC_BASE_URL, the upload API will return that public URL instead.
  app.get("/uploads/*", async (req: Request, res: Response): Promise<void> => {
    const rawKey = (req.params as any)[0] as string;
    const key = rawKey ? decodeURIComponent(rawKey) : "";
    if (!key) {
      res.status(400).send("Missing key");
      return;
    }

    // If a public bucket/domain is configured, redirect to it so browsers fetch directly.
    // This avoids requiring server-to-R2 connectivity for serving assets.
    const base = (r2!.publicBaseUrl || "").replace(/\/$/, "");
    if (base) {
      const encodedKey = key
        .split("/")
        .map((s) => encodeURIComponent(s))
        .join("/");
      res.redirect(302, `${base}/${encodedKey}`);
      return;
    }

    try {
      const out = await r2Client!.send(
        new GetObjectCommand({
          Bucket: r2!.bucket,
          Key: key,
        })
      );

      if (out.ContentType) res.setHeader("Content-Type", out.ContentType);
      if (out.ETag) res.setHeader("ETag", out.ETag);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      const body = out.Body;
      if (!body) {
        res.status(404).send("Not found");
        return;
      }

      // Body is a readable stream in Node
      (body as any).pipe(res);
    } catch (err: any) {
      const name = String(err?.name || "");
      const code = String(err?.code || "");
      const httpCode = err?.$metadata?.httpStatusCode;

      if (name === "NoSuchKey" || httpCode === 404) {
        res.status(404).send("Not found");
        return;
      }

      // If R2 is unreachable (DNS/TLS/network), report 502 so it's clear this is upstream.
      const looksLikeConnectivityIssue =
        [
          "EPROTO",
          "ECONNRESET",
          "ETIMEDOUT",
          "ENOTFOUND",
          "EAI_AGAIN",
        ].includes(code) || name === "TimeoutError";

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
        destination: (
          _req: Request,
          _file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void
        ) => cb(null, uploadDir),
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void
        ) => {
          const ext =
            path.extname(file.originalname || "").toLowerCase() || ".bin";
          const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(
            ext
          )
            ? ext
            : ".bin";
          const rand = Math.random().toString(16).slice(2);
          cb(null, `${Date.now()}-${rand}${safeExt}`);
        },
      }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
      file.mimetype
    );
    if (!ok) {
      cb(new Error("Only image uploads are allowed"));
    } else {
      cb(null, true);
    }
  },
});

// CORS (allow your Vite dev server)
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true, // Enable cookies
  })
);

app.use(cookieParser());

// Admin auth: server sessions stored in Postgres.
const PgSession = connectPgSimple(session);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(
  session({
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
  })
);

// IMPORTANT: Webhook must use raw body BEFORE express.json()
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"];
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        config.stripeWebhookSecret
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(400).send(`Webhook Error: ${errorMessage}`);
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

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

        interface CartItem {
          productId: string;
          quantity: number;
        }

        let cartItems: CartItem[] | null = null;
        const rawCart = session.metadata?.items;
        if (rawCart) {
          try {
            const parsed = JSON.parse(rawCart);
            if (Array.isArray(parsed)) {
              cartItems = parsed
                .filter((i: any) => i && typeof i.productId === "string")
                .map((i: any) => ({
                  productId: i.productId,
                  quantity: parseInt(i.quantity || "0", 10),
                }))
                .filter((i) => Number.isInteger(i.quantity) && i.quantity > 0);

              if (cartItems.length === 0) cartItems = null;
            }
          } catch {
            cartItems = null;
          }
        }

        // Backwards-compatible single-product metadata
        const productId = session.metadata?.productId;
        const sku = session.metadata?.sku;
        const metadataQty = parseInt(session.metadata?.quantity || "0", 10);

        if (!cartItems) {
          if (
            !productId ||
            !sku ||
            !Number.isInteger(metadataQty) ||
            metadataQty <= 0
          ) {
            // Store nothing if metadata is missing; in a real app you'd alert.
            res.status(400).json({ error: "Missing required metadata" });
            return;
          }
          cartItems = [{ productId, quantity: metadataQty }];
        }

        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id,
          {
            limit: 10,
          }
        );

        const purchasedQty = lineItems.data.reduce(
          (sum, li) => sum + (li.quantity || 0),
          0
        );

        // Prefer Stripe total quantity when dealing with a single item.
        const primaryItem = cartItems[0];
        const primaryQuantity =
          cartItems.length === 1
            ? purchasedQty || primaryItem.quantity
            : primaryItem.quantity;

        const customerEmail = session.customer_details?.email || null;
        const customerPhone = session.customer_details?.phone || null;

        const shipping = session.shipping_details || null;
        const address = shipping?.address || null;

        const itemsJson = JSON.stringify(
          lineItems.data.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            amountSubtotal: li.amount_subtotal,
            amountTotal: li.amount_total,
            currency: li.currency,
          })),
          null,
          0
        );

        // Decrement stock safely (won't go negative) + create order.
        // Note: There is still an MVP oversell risk under heavy concurrency.
        await prisma.$transaction(async (tx) => {
          for (const item of cartItems!) {
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
              paymentIntentId:
                typeof session.payment_intent === "string"
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
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
      return;
    }
  }
);

app.use(express.json());

// Auth routes
app.use("/api/auth", authRoutes);

app.get("/api/health", (_req: Request, res: Response): void => {
  res.json({
    ok: true,
    r2: useR2
      ? {
          enabled: true,
          bucket: r2!.bucket,
          publicBaseUrl: r2!.publicBaseUrl || null,
          endpoint: r2S3Endpoint,
        }
      : { enabled: false },
  });
});

interface Product {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  currency: string;
  stock: number;
  description: string | null;
  imageUrl: string | null;
  heatIntensity: number;
  heatProfile: string;
  heatProfileDescriptions?: Record<string, string> | Prisma.JsonValue | null;
  categoryId: string | null;
  variantName: string | null;
  requiresShipping: boolean;
  weightGrams: number | null;
  weightOz: number | null;
  weightG: number | null;
  volumeMl: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  active: boolean;
  bestSeller: boolean;

  // Included on certain queries (e.g. admin/products, products/:id)
  variantValues?: Array<{
    id: string;
    productId: string;
    variantTypeId: string;
    value: string;
    createdAt: Date;
    variantType?: any;
  }>;
}

function serializeProduct(product: Product): Product {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    priceCents: product.priceCents,
    currency: product.currency,
    stock: product.stock,
    description: product.description || null,
    imageUrl: product.imageUrl || null,
    heatIntensity:
      Number.isFinite(product.heatIntensity) && product.heatIntensity >= 0
        ? product.heatIntensity
        : 50,
    categoryId: product.categoryId || null,
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
    bestSeller: product.bestSeller,
    heatProfile: product.heatProfile || "standard",
    heatProfileDescriptions: product.heatProfileDescriptions || undefined,

    // Preserve variant values when present so UIs can display/edit them.
    variantValues: Array.isArray(product.variantValues)
      ? product.variantValues.map((vv: any) => ({
          id: vv.id,
          productId: vv.productId,
          variantTypeId: vv.variantTypeId,
          value: vv.value,
          createdAt: vv.createdAt,
          variantType: vv.variantType
            ? {
                id: vv.variantType.id,
                categoryId: vv.variantType.categoryId ?? null,
                scope: vv.variantType.scope,
                isDefault: vv.variantType.isDefault,
                name: vv.variantType.name,
                displayOrder: vv.variantType.displayOrder,
                createdAt: vv.variantType.createdAt,
                updatedAt: vv.variantType.updatedAt,
              }
            : undefined,
        }))
      : undefined,
  };
}

const HEAT_PROFILE_KEYS = ["gentle", "standard", "inferno"] as const;
type HeatProfileKey = (typeof HEAT_PROFILE_KEYS)[number];
const VALID_HEAT_PROFILES = new Set<HeatProfileKey>(HEAT_PROFILE_KEYS);
const DEFAULT_HEAT_PROFILE_DESCRIPTIONS: Record<HeatProfileKey, string> = {
  gentle: "A subtle, everyday drizzling heat that's accessible to all palates",
  standard: "Balanced numbing heat with Sichuan peppercorn complexity",
  inferno: "Extreme heat for true spice warriors - proceed with caution",
};

function mergeHeatProfileDescriptions(
  source?: unknown
): Record<HeatProfileKey, string> {
  const merged: Record<HeatProfileKey, string> = {
    ...DEFAULT_HEAT_PROFILE_DESCRIPTIONS,
  };
  if (source && typeof source === "object") {
    const payload = source as Record<string, unknown>;
    for (const key of HEAT_PROFILE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const value = payload[key];
        if (typeof value === "string") {
          merged[key] = value;
        }
      }
    }
  }
  return merged;
}

// A) Products endpoints
app.get(
  "/api/products",
  async (_req: Request, res: Response): Promise<void> => {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      include: {
        variantValues: {
          include: { variantType: true },
          orderBy: { variantType: { displayOrder: "asc" } },
        },
      },
    });
    res.json(products.map(serializeProduct));
  }
);

app.get(
  "/api/products/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const product = await prisma.product.findFirst({
      where: { id, active: true },
      include: {
        variantValues: {
          include: { variantType: true },
          orderBy: { variantType: { displayOrder: "asc" } },
        },
      },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(serializeProduct(product));
  }
);

// Public: category images (used by storefront product page)
app.get(
  "/api/categories/:categoryId/images",
  async (req: Request, res: Response): Promise<void> => {
    const categoryId = String(req.params.categoryId || "").trim();
    if (!categoryId) {
      res.status(400).json({ error: "categoryId is required" });
      return;
    }

    const images = await prisma.productImage.findMany({
      where: { categoryId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        url: true,
        alt: true,
        sortOrder: true,
      },
    });

    res.json(images);
  }
);

// Legacy featured-product endpoint (kept for compatibility)
app.get("/api/product", async (_req: Request, res: Response): Promise<void> => {
  const featured = await prisma.product.findFirst({
    where: { id: "red-ember-spice", active: true },
  });

  const fallback =
    featured ||
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
app.post(
  "/api/checkout",
  async (req: Request, res: Response): Promise<void> => {
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create checkout session" });
      return;
    }
  }
);

// C) Cart checkout session creation (multiple line items)
app.post(
  "/api/checkout/cart",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const itemsRaw = req.body?.items;
      if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
        res.status(400).json({ error: "items must be a non-empty array" });
        return;
      }

      // Normalize + combine duplicates
      const combined = new Map<string, number>();
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

      interface CartItem {
        productId: string;
        quantity: number;
      }

      const items: CartItem[] = Array.from(combined.entries()).map(
        ([productId, quantity]) => ({
          productId,
          quantity,
        })
      );

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
        const p = productById.get(i.productId)!;
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create checkout session" });
      return;
    }
  }
);

// D) Admin endpoints (token protected)
app.get(
  "/api/admin/inventory",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(
      products.map((p) => ({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        variantName: p.variantName || null,
        categoryId: p.categoryId || null,
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
      }))
    );
  }
);

// Admin: product categories
app.get(
  "/api/admin/categories",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const categories = await prisma.productCategory.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(categories);
  }
);

app.post(
  "/api/admin/categories",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
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

    const created = await prisma.productCategory.create({
      data: {
        name,
        handle,
        description,
        active: true,
      },
    });
    res.status(201).json(created);
  }
);

app.put(
  "/api/admin/categories/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const name = (req.body?.name || "").trim();
    const handle = (req.body?.handle || "").trim();
    const description = (req.body?.description || "").trim() || null;
    const active =
      typeof req.body?.active === "boolean" ? req.body.active : undefined;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!handle) {
      res.status(400).json({ error: "handle is required" });
      return;
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data: {
        name,
        handle,
        description,
        ...(active === undefined ? {} : { active }),
      },
    });
    res.json(updated);
  }
);

app.delete(
  "/api/admin/categories/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    // prevent deleting if it still has products
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      res
        .status(400)
        .json({ error: "Cannot delete category with existing variants" });
      return;
    }

    await prisma.productCategory.delete({ where: { id } });
    res.json({ ok: true });
  }
);

async function ensureDefaultVariantTypes(): Promise<void> {
  const defaults: Array<{ name: string; displayOrder: number }> = [
    { name: "Size", displayOrder: 0 },
    { name: "Color", displayOrder: 1 },
  ];

  await Promise.all(
    defaults.map((d) =>
      prisma.productVariantType.upsert({
        where: {
          scope_name: {
            scope: "global",
            name: d.name,
          },
        },
        update: {
          isDefault: true,
          displayOrder: d.displayOrder,
        },
        create: {
          scope: "global",
          isDefault: true,
          name: d.name,
          displayOrder: d.displayOrder,
        },
      })
    )
  );
}

// Admin: Variant Types
app.get(
  "/api/admin/variant-types",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    await ensureDefaultVariantTypes();
    const types = await prisma.productVariantType.findMany({
      where: {
        scope: "global",
      },
      orderBy: [
        { isDefault: "desc" },
        { displayOrder: "asc" },
        { name: "asc" },
      ],
    });
    res.json(types);
  }
);

app.post(
  "/api/admin/variant-types",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { name, displayOrder } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const trimmed = name.trim();
    const created = await prisma.productVariantType.upsert({
      where: {
        scope_name: {
          scope: "global",
          name: trimmed,
        },
      },
      update: {
        displayOrder:
          typeof displayOrder === "number" ? displayOrder : undefined,
      },
      create: {
        scope: "global",
        name: trimmed,
        displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
      },
    });

    res.json(created);
  }
);

app.delete(
  "/api/admin/variant-types/:typeId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const typeId = String((req.params as any).typeId || "");
    const found = await prisma.productVariantType.findUnique({
      where: { id: typeId },
    });
    if (!found || found.scope !== "global") {
      res.status(404).json({ error: "Variant type not found" });
      return;
    }
    if (found.isDefault) {
      res
        .status(400)
        .json({ error: "Default variant types cannot be deleted" });
      return;
    }
    await prisma.productVariantType.delete({ where: { id: typeId } });
    res.json({ ok: true });
  }
);

app.get(
  "/api/admin/categories/:categoryId/variant-types",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const categoryId = req.params.categoryId as string;
    const categoryScope = `category:${categoryId}`;
    const legacyScope = `group:${categoryId}`;
    const types = await prisma.productVariantType.findMany({
      where: {
        OR: [
          { scope: categoryScope },
          { scope: legacyScope },
          { scope: "global", isDefault: true },
        ],
      },
      orderBy: { displayOrder: "asc" },
    });
    res.json(types);
  }
);

app.post(
  "/api/admin/categories/:categoryId/variant-types",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const categoryId = req.params.categoryId as string;
    const { name, displayOrder } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const categoryScope = `category:${categoryId}`;
    const type = await prisma.productVariantType.create({
      data: {
        categoryId,
        scope: categoryScope,
        name: name.trim(),
        displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
      },
    });
    res.json(type);
  }
);

app.delete(
  "/api/admin/categories/:categoryId/variant-types/:typeId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const typeId = String((req.params as any).typeId || "");
    const found = await prisma.productVariantType.findUnique({
      where: { id: typeId },
    });
    const categoryId = req.params.categoryId as string;
    const categoryScope = `category:${categoryId}`;
    const legacyScope = `group:${categoryId}`;
    if (
      !found ||
      (found.scope !== categoryScope && found.scope !== legacyScope)
    ) {
      res.status(404).json({ error: "Variant type not found" });
      return;
    }
    await prisma.productVariantType.delete({ where: { id: typeId } });
    res.json({ ok: true });
  }
);

// Admin: Product Variant Values
app.put(
  "/api/admin/products/:productId/variant-values",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const productId = req.params.productId as string;
      const { values } = req.body;

      if (!Array.isArray(values)) {
        res.status(400).json({ error: "values must be an array" });
        return;
      }

      // Delete existing values
      await prisma.productVariantValue.deleteMany({ where: { productId } });

      // Create new values
      const normalized: Array<{ variantTypeId: string; value: string }> = [];
      const seen = new Set<string>();

      for (const raw of values) {
        const variantTypeId = String(raw?.variantTypeId || "").trim();
        const value = String(raw?.value || "").trim();
        if (!variantTypeId || !value) continue;
        const key = `${variantTypeId}::${value.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push({ variantTypeId, value });
      }

      const created = await Promise.all(
        normalized.map((v) =>
          prisma.productVariantValue.create({
            data: {
              productId,
              variantTypeId: v.variantTypeId,
              value: v.value,
            },
            include: { variantType: true },
          })
        )
      );

      res.json(created);
    } catch (err: any) {
      console.error("Failed to set variant values", err);
      res.status(500).json({ error: err?.message || "Internal Server Error" });
    }
  }
);

// Admin: Category Images
app.get(
  "/api/admin/categories/:categoryId/images",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const categoryId = req.params.categoryId as string;
    const images = await prisma.productImage.findMany({
      where: { categoryId },
      orderBy: { sortOrder: "asc" },
      include: {
        media: true,
      },
    });
    res.json(images);
  }
);

app.post(
  "/api/admin/categories/:categoryId/images",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const categoryId = req.params.categoryId as string;
    const mediaId = (req.body?.mediaId || "").trim();

    if (!mediaId) {
      res.status(400).json({ error: "mediaId is required" });
      return;
    }

    // Check if category exists
    const category = await prisma.productCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    // Check if media exists
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media) {
      res.status(404).json({ error: "Media not found" });
      return;
    }

    // Get max sortOrder and add 1
    const maxImage = await prisma.productImage.findFirst({
      where: { categoryId },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (maxImage?.sortOrder ?? -1) + 1;

    const image = await prisma.productImage.create({
      data: {
        categoryId,
        mediaId,
        sortOrder,
      },
      include: {
        media: true,
      },
    });
    res.status(201).json(image);
  }
);

app.put(
  "/api/admin/categories/:categoryId/images/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const categoryId = req.params.categoryId as string;
    const sortOrder =
      typeof req.body?.sortOrder === "number" ? req.body.sortOrder : undefined;

    const image = await prisma.productImage.findUnique({ where: { id } });
    if (!image || image.categoryId !== categoryId) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    const updated = await prisma.productImage.update({
      where: { id },
      data: {
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });
    res.json(updated);
  }
);

app.delete(
  "/api/admin/categories/:categoryId/images/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const categoryId = req.params.categoryId as string;

    const image = await prisma.productImage.findUnique({ where: { id } });
    if (!image || image.categoryId !== categoryId) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    await prisma.productImage.delete({ where: { id } });
    res.json({ ok: true });
  }
);

// Reorder images: accepts array of {id, sortOrder}
app.post(
  "/api/admin/categories/:categoryId/images/reorder",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const categoryId = req.params.categoryId as string;
    const updates = req.body?.updates || [];

    if (!Array.isArray(updates)) {
      res.status(400).json({ error: "updates array is required" });
      return;
    }

    // Update each image's sortOrder
    await Promise.all(
      updates.map((u: { id: string; sortOrder: number }) =>
        prisma.productImage.update({
          where: { id: u.id },
          data: { sortOrder: u.sortOrder },
        })
      )
    );

    const images = await prisma.productImage.findMany({
      where: { categoryId },
      orderBy: { sortOrder: "asc" },
    });
    res.json(images);
  }
);

// ========== Media Library ==========
// Get all media assets
app.get(
  "/api/admin/media",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const media = await prisma.media.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        productImages: {
          select: {
            productId: true,
            categoryId: true,
          },
        },
      },
    });

    // Transform to include usage info
    const mediaWithUsage = media.map((m) => ({
      id: m.id,
      url: m.url,
      filename: m.filename,
      size: m.size,
      mimeType: m.mimeType,
      alt: m.alt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      isUsed: m.productImages.length > 0,
      usageCount: m.productImages.length,
    }));

    res.json(mediaWithUsage);
  }
);

// Add media asset to library
app.post(
  "/api/admin/media",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const url = (req.body?.url || "").trim();
    const filename = (req.body?.filename || "").trim() || null;
    const size = req.body?.size || null;
    const mimeType = (req.body?.mimeType || "").trim() || null;
    const alt = (req.body?.alt || "").trim() || null;

    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    // Check if media already exists
    const existing = await prisma.media.findUnique({ where: { url } });
    if (existing) {
      res.json(existing);
      return;
    }

    // Create new media record
    const media = await prisma.media.create({
      data: {
        url,
        filename,
        size,
        mimeType,
        alt,
      },
    });
    res.status(201).json(media);
  }
);

// ========== Product Image Management ==========
app.get(
  "/api/admin/products/:productId/images",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params.productId as string;
    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: "asc" },
      include: { media: true },
    });
    res.json(images);
  }
);

app.post(
  "/api/admin/products/:productId/images",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params.productId as string;
    const mediaId = (req.body?.mediaId || "").trim();
    const isMain = req.body?.isMain === true;

    if (!mediaId) {
      res.status(400).json({ error: "mediaId is required" });
      return;
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Check if media exists
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media) {
      res.status(404).json({ error: "Media not found" });
      return;
    }

    // If this is marked as main, unset all other main images for this product
    if (isMain) {
      await prisma.productImage.updateMany({
        where: { productId, isMain: true },
        data: { isMain: false },
      });
    }

    // Get max sortOrder and add 1
    const maxImage = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (maxImage?.sortOrder ?? -1) + 1;

    const image = await prisma.productImage.create({
      data: {
        productId,
        mediaId,
        isMain,
        sortOrder,
      },
    });
    
    // Return with media data included
    const result = await prisma.productImage.findUnique({
      where: { id: image.id },
      include: { media: true },
    });
    res.status(201).json(result);
  }
);

app.patch(
  "/api/admin/products/:productId/images/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const productId = req.params.productId as string;
    const sortOrder =
      typeof req.body?.sortOrder === "number" ? req.body.sortOrder : undefined;
    const isMain =
      req.body?.isMain !== undefined ? req.body.isMain === true : undefined;

    const image = await prisma.productImage.findUnique({ where: { id } });
    if (!image || image.productId !== productId) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    // If setting this as main, unset all others
    if (isMain === true) {
      await prisma.productImage.updateMany({
        where: { productId, isMain: true, id: { not: id } },
        data: { isMain: false },
      });
    }

    const updated = await prisma.productImage.update({
      where: { id },
      data: {
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isMain !== undefined ? { isMain } : {}),
      },
    });
    res.json(updated);
  }
);

app.delete(
  "/api/admin/products/:productId/images/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const productId = req.params.productId as string;

    const image = await prisma.productImage.findUnique({ where: { id } });
    if (!image || image.productId !== productId) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    await prisma.productImage.delete({ where: { id } });
    res.json({ ok: true });
  }
);

app.post(
  "/api/admin/products/:productId/images/reorder",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params.productId as string;
    const imageIds = req.body?.imageIds || [];

    if (!Array.isArray(imageIds)) {
      res.status(400).json({ error: "imageIds array is required" });
      return;
    }

    // Update sortOrder based on array position
    await Promise.all(
      imageIds.map((imageId: string, index: number) =>
        prisma.productImage.update({
          where: { id: imageId },
          data: { sortOrder: index },
        })
      )
    );

    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: "asc" },
    });
    res.json(images);
  }
);

// Admin: variants (Products)
app.get(
  "/api/admin/products",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        variantValues: {
          include: { variantType: true },
          orderBy: { variantType: { displayOrder: "asc" } },
        },
      },
    });
    res.json(products.map(serializeProduct));
  }
);

app.post(
  "/api/admin/products",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body || {};
    const id = (body.id || "").trim();
    const name = (body.name || "").trim();
    const sku = (body.sku || "").trim();
    const currency = (body.currency || "usd").trim().toLowerCase();
    const priceCents = Number(body.priceCents);
    const stock = Number(body.stock);
    const heatIntensityRaw = body.heatIntensity;
    const heatIntensity =
      heatIntensityRaw === undefined || heatIntensityRaw === null
        ? undefined
        : Number(heatIntensityRaw);
    const heatProfileRaw =
      typeof body.heatProfile === "string"
        ? body.heatProfile.trim().toLowerCase()
        : "";
    const heatProfile = heatProfileRaw || "standard";
    const heatProfileDescriptions = mergeHeatProfileDescriptions(
      body.heatProfileDescriptions
    );

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
    if (heatIntensity !== undefined) {
      if (
        !Number.isInteger(heatIntensity) ||
        heatIntensity < 0 ||
        heatIntensity > 100
      ) {
        res.status(400).json({
          error: "heatIntensity must be an integer between 0 and 100",
        });
        return;
      }
    }
    if (!VALID_HEAT_PROFILES.has(heatProfile)) {
      res.status(400).json({
        error: "heatProfile must be one of gentle, standard, inferno",
      });
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
        description:
          typeof body.description === "string" ? body.description : null,
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
        heatIntensity: heatIntensity === undefined ? undefined : heatIntensity,
        heatProfile,
        heatProfileDescriptions,
        categoryId:
          typeof body.categoryId === "string" ? body.categoryId : null,
        variantName:
          typeof body.variantName === "string" ? body.variantName : null,
        requiresShipping:
          typeof body.requiresShipping === "boolean"
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
  }
);

app.put(
  "/api/admin/products/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const body = req.body || {};

    const data: any = {};
    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.sku === "string") data.sku = body.sku.trim();
    if (typeof body.currency === "string")
      data.currency = body.currency.trim().toLowerCase();
    if (typeof body.description === "string")
      data.description = body.description;
    if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl;
    if (typeof body.categoryId === "string") data.categoryId = body.categoryId;
    if (body.categoryId === null) data.categoryId = null;
    if (typeof body.variantName === "string")
      data.variantName = body.variantName;
    if (body.variantName === null) data.variantName = null;
    if (typeof body.heatProfile === "string") {
      const profile = body.heatProfile.trim().toLowerCase();
      if (!VALID_HEAT_PROFILES.has(profile)) {
        res.status(400).json({
          error: "heatProfile must be one of gentle, standard, inferno",
        });
        return;
      }
      data.heatProfile = profile;
    }

    if (
      body.heatProfileDescriptions &&
      typeof body.heatProfileDescriptions === "object"
    ) {
      data.heatProfileDescriptions = mergeHeatProfileDescriptions(
        body.heatProfileDescriptions
      );
    }

    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.bestSeller === "boolean") data.bestSeller = body.bestSeller;
    if (typeof body.requiresShipping === "boolean")
      data.requiresShipping = body.requiresShipping;

    if (body.heatIntensity !== undefined) {
      const v = Number(body.heatIntensity);
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        res.status(400).json({
          error: "heatIntensity must be an integer between 0 and 100",
        });
        return;
      }
      data.heatIntensity = v;
    }

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
      } else if (body[key] !== undefined) {
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
  }
);

app.delete(
  "/api/admin/products/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    const orderCount = await prisma.order.count({ where: { productId: id } });
    if (orderCount > 0) {
      res
        .status(400)
        .json({ error: "Cannot delete a product that has orders" });
      return;
    }

    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  }
);

// Admin: upload an image and get back a URL usable in imageUrl
app.post(
  "/api/admin/upload",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
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
    const ext =
      path.extname(req.file.originalname || "").toLowerCase() || ".bin";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : ".bin";

    // Determine folder based on query parameter
    const folder =
      req.query.folder === "branding" ? "branding" : "product-images";
    const key = `${folder}/${Date.now()}-${randomUUID()}${safeExt}`;

    try {
      await r2Client!.send(
        new PutObjectCommand({
          Bucket: r2!.bucket,
          Key: key,
          Body: (req.file as any).buffer,
          ContentType: req.file.mimetype,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      // If you configured a public bucket/domain, prefer returning a public URL.
      const base = (r2!.publicBaseUrl || "").replace(/\/$/, "");
      if (base) {
        res.status(201).json({ url: `${base}/${key}` });
        return;
      }

      // Otherwise return our proxy URL (works with private buckets).
      res.status(201).json({ url: `/uploads/${encodeURIComponent(key)}` });
    } catch (err: any) {
      const name = String(err?.name || "");
      const code = String(err?.code || "");
      const looksLikeConnectivityIssue =
        [
          "EPROTO",
          "ECONNRESET",
          "ETIMEDOUT",
          "ENOTFOUND",
          "EAI_AGAIN",
        ].includes(code) || name === "TimeoutError";

      res
        .status(looksLikeConnectivityIssue ? 502 : 500)
        .json({ error: "Upload failed" });
    }
  }
);

// Admin: delete an image from R2
app.delete(
  "/api/admin/media/:key(*)",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const key = Array.isArray(req.params.key)
      ? req.params.key[0]
      : req.params.key;

    if (!key) {
      res.status(400).json({ error: "key is required" });
      return;
    }

    if (!useR2) {
      // Delete local file
      const filePath = path.join(uploadDir, key);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: "Delete failed" });
      }
      return;
    }

    // Delete from R2
    try {
      await r2Client!.send(
        new DeleteObjectCommand({
          Bucket: r2!.bucket,
          Key: key,
        })
      );
      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Delete failed" });
    }
  }
);

// Admin: list all media files
app.get(
  "/api/admin/media",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const folder = req.query.folder as string | undefined;

    if (!useR2) {
      // List local files
      try {
        const files = fs.readdirSync(uploadDir);
        const urls = files.map((file) => ({
          url: `/uploads/${file}`,
          key: file,
        }));
        res.status(200).json(urls);
      } catch (err: any) {
        res.status(500).json({ error: "Failed to list media" });
      }
      return;
    }

    // List from R2
    try {
      const command = new ListObjectsV2Command({
        Bucket: r2!.bucket,
        Prefix: folder || "",
        MaxKeys: 1000,
      });

      const response = await r2Client!.send(command);
      const items = response.Contents || [];

      const base = (r2!.publicBaseUrl || "").replace(/\/$/, "");
      const urls = items.map((item) => ({
        url: base
          ? `${base}/${item.Key}`
          : `/uploads/${encodeURIComponent(item.Key!)}`,
        key: item.Key!,
        size: item.Size,
        lastModified: item.LastModified,
      }));

      res.status(200).json(urls);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to list media" });
    }
  }
);

type ItemsJsonEntry = {
  productId?: string;
  sku?: string;
  description?: string;
  quantity?: number;
  amountSubtotal?: number;
  amountTotal?: number;
  currency?: string;
};

function safeParseItemsJson(itemsJson: string): ItemsJsonEntry[] {
  try {
    const parsed = JSON.parse(itemsJson || "[]");
    return Array.isArray(parsed) ? (parsed as ItemsJsonEntry[]) : [];
  } catch {
    return [];
  }
}

function adminOrderDto(o: any): any {
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
  const fallbackItems =
    items.length > 0
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

async function calculateShippingInternal(params: {
  items: Array<{ productId: string; quantity: number }>;
  country: string;
}): Promise<{
  shippingCents: number;
  totalWeightG: number;
  freeShippingMin: number | null;
  zoneName: string;
}> {
  const { items, country } = params;
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalWeightG = 0;
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;

    const qty = Number(item.quantity) || 1;
    let weightG = 0;
    if (product.weightG) {
      weightG = product.weightG;
    } else if (product.weightOz) {
      weightG = product.weightOz * 28.3495;
    } else if (product.weightGrams) {
      weightG = product.weightGrams;
    } else if (product.volumeMl) {
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
  let freeShippingMin: number | null = null;
  let zoneName = "Default";

  if (zone) {
    zoneName = zone.name;
    freeShippingMin = zone.freeShippingMin;
    const tier = zone.weightTiers.find(
      (t) => totalWeightG >= t.minWeightG && totalWeightG <= t.maxWeightG
    );
    if (tier) {
      shippingCents = tier.rateCents;
    } else {
      const maxTier = zone.weightTiers[zone.weightTiers.length - 1];
      shippingCents = maxTier?.rateCents || 0;
    }
  } else {
    if (totalWeightG <= 250) {
      shippingCents = 450;
    } else if (totalWeightG <= 750) {
      shippingCents = 875;
    } else {
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

app.get(
  "/api/admin/orders",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });

    res.json(orders.map(adminOrderDto));
  }
);

app.post(
  "/api/admin/orders/manual",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body || {};
      const itemsRaw = body.items;
      if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
        res.status(400).json({ error: "items array is required" });
        return;
      }

      const items = itemsRaw
        .map((i: any) => ({
          productId: String(i?.productId || "").trim(),
          quantity: parseInt(String(i?.quantity || "0"), 10),
        }))
        .filter(
          (i: any) =>
            i.productId && Number.isInteger(i.quantity) && i.quantity > 0
        );

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
      if (
        products.some((p) => (p.currency || "usd").toLowerCase() !== currency)
      ) {
        res
          .status(400)
          .json({ error: "All items must have the same currency" });
        return;
      }

      const requiresShipping = products.some((p) => p.requiresShipping);

      const addr = body.shippingAddress || {};
      const country =
        String(addr.country || "US")
          .trim()
          .toUpperCase() || "US";
      const shippingLine1 = String(addr.line1 || "").trim();
      const shippingLine2 = String(addr.line2 || "").trim();
      const shippingCity = String(addr.city || "").trim();
      const shippingState = String(addr.state || "").trim();
      const shippingPostal = String(addr.postal || "").trim();

      if (requiresShipping) {
        if (
          !shippingLine1 ||
          !shippingCity ||
          !shippingState ||
          !shippingPostal ||
          !country
        ) {
          res.status(400).json({
            error:
              "shippingAddress is required for shippable items (line1, city, state, postal, country)",
          });
          return;
        }
      }

      let subtotalCents = 0;
      for (const it of items) {
        const p = productMap.get(it.productId)!;
        subtotalCents += (p.priceCents || 0) * it.quantity;
      }

      let shippingCents = 0;
      let freeShippingMin: number | null = null;

      const overrideShipping = body.shippingCents;
      if (!requiresShipping) {
        shippingCents = 0;
      } else if (
        overrideShipping !== undefined &&
        overrideShipping !== null &&
        overrideShipping !== ""
      ) {
        const v = Number(overrideShipping);
        if (!Number.isFinite(v) || v < 0) {
          res
            .status(400)
            .json({ error: "shippingCents must be a number >= 0" });
          return;
        }
        shippingCents = Math.round(v);
      } else {
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
      const primaryProduct = productMap.get(primaryItem.productId)!;

      const itemsJson = JSON.stringify(
        items.map((it) => {
          const p = productMap.get(it.productId)!;
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
        }),
        null,
        0
      );

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
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create manual order";
      res.status(500).json({ error: msg });
    }
  }
);

app.get(
  "/api/admin/customers",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
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
        const email = (g.email as string).trim();
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
        const status: "active" | "inactive" =
          lastMs >= inactiveCutoffMs ? "active" : "inactive";

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
  }
);

// Public: Calculate shipping cost for cart
app.post(
  "/api/shipping/calculate",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, country } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "Items array is required" });
        return;
      }

      // Get all products
      const productIds = items.map((i: any) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      // Calculate total weight in grams
      let totalWeightG = 0;
      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) continue;

        const qty = parseInt(item.quantity) || 1;

        // Use the most precise weight available
        let weightG = 0;
        if (product.weightG) {
          weightG = product.weightG;
        } else if (product.weightOz) {
          weightG = product.weightOz * 28.3495; // oz to grams
        } else if (product.weightGrams) {
          weightG = product.weightGrams;
        } else if (product.volumeMl) {
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
        const tier = zone.weightTiers.find(
          (t) => totalWeightG >= t.minWeightG && totalWeightG <= t.maxWeightG
        );

        if (tier) {
          shippingCents = tier.rateCents;
        } else {
          // Use highest tier if over max weight
          const maxTier = zone.weightTiers[zone.weightTiers.length - 1];
          shippingCents = maxTier?.rateCents || 0;
        }
      } else {
        // Fallback calculation if no zone configured
        if (totalWeightG <= 250) {
          shippingCents = 450; // $4.50
        } else if (totalWeightG <= 750) {
          shippingCents = 875; // $8.75
        } else {
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
    } catch (error) {
      console.error("Shipping calculation error:", error);
      res.status(500).json({ error: "Failed to calculate shipping" });
    }
  }
);

// Admin Users Management
app.get(
  "/api/admin/users",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.adminUser.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(users);
    } catch (error) {
      console.error("List admin users error:", error);
      res.status(500).json({ error: "Failed to list users" });
    }
  }
);

app.post(
  "/api/admin/users",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name, active } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const existing = await prisma.adminUser.findUnique({
        where: { email },
      });

      if (existing) {
        res.status(400).json({ error: "User with this email already exists" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.adminUser.create({
        data: {
          email,
          passwordHash,
          name: name || null,
          active: active ?? true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          createdAt: true,
        },
      });

      res.status(201).json(user);
    } catch (error) {
      console.error("Create admin user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  }
);

app.put(
  "/api/admin/users/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String((req.params as any).id || "");
      const { name, active } = req.body;

      const data: any = {};
      if (name !== undefined) data.name = name || null;
      if (active !== undefined) data.active = active;

      const user = await prisma.adminUser.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          createdAt: true,
        },
      });

      res.json(user);
    } catch (error) {
      console.error("Update admin user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  }
);

app.delete(
  "/api/admin/users/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String((req.params as any).id || "");

      await prisma.adminUser.delete({
        where: { id },
      });

      res.json({ ok: true });
    } catch (error) {
      console.error("Delete admin user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  }
);

app.post(
  "/api/admin/users/:id/password",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String((req.params as any).id || "");
      const { password } = req.body;

      if (!password) {
        res.status(400).json({ error: "Password is required" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await prisma.adminUser.update({
        where: { id },
        data: { passwordHash },
      });

      res.json({ ok: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  }
);

// Admin: Get shipping configuration
app.get(
  "/api/admin/shipping",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
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
    } catch (error) {
      console.error("Get shipping config error:", error);
      res.status(500).json({ error: "Failed to get shipping configuration" });
    }
  }
);

// Admin: Update shipping zone
app.put(
  "/api/admin/shipping/zones/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: rawId } = req.params;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { name, countries, enabled, freeShippingMin, weightTiers } =
        req.body;

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
          data: weightTiers.map((tier: any) => ({
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
    } catch (error) {
      console.error("Update shipping zone error:", error);
      res.status(500).json({ error: "Failed to update shipping zone" });
    }
  }
);

// Admin: Create shipping zone
app.post(
  "/api/admin/shipping/zones",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, countries, enabled, freeShippingMin, weightTiers } =
        req.body;

      const zone = await prisma.shippingZone.create({
        data: {
          name,
          countries: countries || [],
          enabled: enabled ?? true,
          freeShippingMin: freeShippingMin || null,
          weightTiers: {
            create: (weightTiers || []).map((tier: any) => ({
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
    } catch (error) {
      console.error("Create shipping zone error:", error);
      res.status(500).json({ error: "Failed to create shipping zone" });
    }
  }
);

// Central error handler (must be after routes)
app.use(
  (err: Error, _req: Request, res: Response, next: NextFunction): void => {
    if (!err) {
      next();
      return;
    }
    const message = err?.message || "Request failed";

    // Multer validation errors should be 400s.
    if (
      message.toLowerCase().includes("only image") ||
      message.toLowerCase().includes("file")
    ) {
      res.status(400).json({ error: message });
      return;
    }

    console.error("Unhandled server error:", err);
    res.status(500).json({ error: "Server error" });
  }
);

// ============================================================
// SETTINGS API
// ============================================================

// Public settings endpoint (no auth required) - only returns public-safe settings
app.get(
  "/api/settings",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const settings = await prisma.storeSetting.findMany();
      const settingsMap: Record<string, any> = {};

      // Only expose public settings
      const publicKeys = [
        "primaryColor",
        "storeName",
        "storeDescription",
        "logoUrl",
        "faviconUrl",
        "currency",
        "supportEmail",
        "supportPhone",
      ];

      for (const setting of settings) {
        if (publicKeys.includes(setting.key)) {
          try {
            settingsMap[setting.key] = JSON.parse(setting.value);
          } catch {
            settingsMap[setting.key] = setting.value;
          }
        }
      }

      res.json(settingsMap);
    } catch (err: any) {
      console.error("Failed to load public settings:", err);
      res.status(500).json({ error: "Failed to load settings" });
    }
  }
);

// Admin settings endpoint (requires auth) - returns all settings
app.get(
  "/api/admin/settings",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const settings = await prisma.storeSetting.findMany();
      const settingsMap: Record<string, any> = {};

      for (const setting of settings) {
        try {
          settingsMap[setting.key] = JSON.parse(setting.value);
        } catch {
          settingsMap[setting.key] = setting.value;
        }
      }

      res.json(settingsMap);
    } catch (err: any) {
      console.error("Failed to load settings:", err);
      res.status(500).json({ error: "Failed to load settings" });
    }
  }
);

app.put(
  "/api/admin/settings",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const updates = req.body;

      for (const [key, value] of Object.entries(updates)) {
        const stringValue =
          typeof value === "string" ? value : JSON.stringify(value);

        await prisma.storeSetting.upsert({
          where: { key },
          update: { value: stringValue },
          create: { key, value: stringValue },
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      res.status(500).json({ error: "Failed to save settings" });
    }
  }
);

async function start(): Promise<void> {
  // await ensureSeedProduct(); // Hard-coded products removed
  await ensureDefaultShippingZone();

  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

start().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
