import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();
async function main() {
    const products = [
        {
            id: "red-ember-spice",
            name: "Red Ember Spice",
            sku: "RES-100",
            priceCents: 1800,
            currency: "usd",
            stock: 100,
            variantName: "100ml",
            categoryHandle: "red-ember-spice",
            imageUrl: "https://images.unsplash.com/photo-1604909053196-3f1f510c2c5c?auto=format&fit=crop&q=80&w=1400",
        },
        {
            id: "smoked-ghost",
            name: "Smoked Ghost Pepper",
            sku: "SGP-175",
            priceCents: 2400,
            currency: "usd",
            stock: 35,
            variantName: "175ml",
            categoryHandle: "smoked-ghost",
            imageUrl: "https://images.unsplash.com/photo-1626808642875-0aa545482dfb?auto=format&fit=crop&q=80&w=1400",
        },
        {
            id: "honey-habanero",
            name: "Honey Habanero",
            sku: "HHB-175",
            priceCents: 2000,
            currency: "usd",
            stock: 48,
            variantName: "175ml",
            categoryHandle: "honey-habanero",
            imageUrl: "https://images.unsplash.com/photo-1600628422019-6c1b0b2f7b1c?auto=format&fit=crop&q=80&w=1400",
        },
        {
            id: "sichuan-gold",
            name: "Sichuan Peppercorn Gold",
            sku: "SPG-175",
            priceCents: 2200,
            currency: "usd",
            stock: 22,
            variantName: "175ml",
            categoryHandle: "sichuan-gold",
            imageUrl: "https://images.unsplash.com/photo-1615485737657-9f5f0a2d9b0a?auto=format&fit=crop&q=80&w=1400",
        },
    ];
    const categoryHandles = Array.from(new Set(products.map((p) => p.categoryHandle)));
    const categories = await Promise.all(categoryHandles.map((handle) => {
        const primary = products.find((p) => p.categoryHandle === handle);
        return prisma.productCategory.upsert({
            where: { handle },
            update: {
                name: primary?.name || handle,
                active: true,
            },
            create: {
                handle,
                name: primary?.name || handle,
                active: true,
            },
        });
    }));
    const categoryIdByHandle = new Map(categories.map((g) => [g.handle, g.id]));
    await Promise.all(products.map((p) => prisma.product.upsert({
        where: { id: p.id },
        update: {
            name: p.name,
            sku: p.sku,
            priceCents: p.priceCents,
            currency: p.currency,
            categoryId: categoryIdByHandle.get(p.categoryHandle) || null,
            variantName: p.variantName,
            imageUrl: p.imageUrl,
            requiresShipping: true,
            weightGrams: 450,
        },
        create: {
            id: p.id,
            name: p.name,
            sku: p.sku,
            priceCents: p.priceCents,
            currency: p.currency,
            stock: p.stock,
            categoryId: categoryIdByHandle.get(p.categoryHandle) || null,
            variantName: p.variantName,
            imageUrl: p.imageUrl,
            requiresShipping: true,
            weightGrams: 450,
            active: true,
        },
    })));
    const seeded = await prisma.product.findMany({
        orderBy: { createdAt: "asc" },
    });
    console.log("Seeded products:", seeded);
    // Create default admin user
    const adminEmail = "admin@redember.com";
    const adminPassword = "admin123"; // Change this in production!
    const existingAdmin = await prisma.adminUser.findUnique({
        where: { email: adminEmail },
    });
    if (!existingAdmin) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await prisma.adminUser.create({
            data: {
                email: adminEmail,
                passwordHash,
                name: "Admin User",
                active: true,
            },
        });
        console.log("\n✅ Created admin user:");
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
        console.log("   ⚠️  CHANGE PASSWORD IN PRODUCTION!\n");
    }
    else {
        console.log("\nℹ️  Admin user already exists\n");
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
