import { prisma } from "./db";
export async function ensureSeedProduct() {
    const products = [
        {
            id: "red-ember-spice",
            name: "Red Ember Spice",
            sku: "RES-100",
            priceCents: 1800,
            currency: "usd",
            stock: 100,
            variantName: "100ml",
            groupHandle: "red-ember-spice",
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
            groupHandle: "smoked-ghost",
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
            groupHandle: "honey-habanero",
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
            groupHandle: "sichuan-gold",
            imageUrl: "https://images.unsplash.com/photo-1615485737657-9f5f0a2d9b0a?auto=format&fit=crop&q=80&w=1400",
        },
    ];
    const groupHandles = Array.from(new Set(products.map((p) => p.groupHandle)));
    const groups = await Promise.all(groupHandles.map((handle) => {
        const primary = products.find((p) => p.groupHandle === handle);
        return prisma.productGroup.upsert({
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
    const groupIdByHandle = new Map(groups.map((g) => [g.handle, g.id]));
    await Promise.all(products.map((p) => prisma.product.upsert({
        where: { id: p.id },
        update: {
            name: p.name,
            sku: p.sku,
            priceCents: p.priceCents,
            currency: p.currency,
            groupId: groupIdByHandle.get(p.groupHandle) || null,
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
            groupId: groupIdByHandle.get(p.groupHandle) || null,
            variantName: p.variantName,
            imageUrl: p.imageUrl,
            requiresShipping: true,
            weightGrams: 450,
            active: true,
        },
    })));
}
