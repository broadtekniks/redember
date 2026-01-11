import { prisma } from "./db";
export async function ensureDefaultShippingZone() {
    const existingZone = await prisma.shippingZone.findFirst({
        where: { name: "United States" },
    });
    if (!existingZone) {
        console.log("Creating default US shipping zone with weight tiers...");
        await prisma.shippingZone.create({
            data: {
                name: "United States",
                countries: ["US"],
                enabled: true,
                freeShippingMin: 7500, // $75 free shipping threshold
                weightTiers: {
                    create: [
                        {
                            minWeightG: 0,
                            maxWeightG: 250,
                            rateCents: 450, // $4.50 for small bottles (up to 250g)
                        },
                        {
                            minWeightG: 251,
                            maxWeightG: 750,
                            rateCents: 875, // $8.75 for medium orders (251-750g)
                        },
                        {
                            minWeightG: 751,
                            maxWeightG: 2000,
                            rateCents: 1200, // $12.00 for larger orders (751-2000g)
                        },
                        {
                            minWeightG: 2001,
                            maxWeightG: 10000,
                            rateCents: 1800, // $18.00 for bulk orders (2-10kg)
                        },
                    ],
                },
            },
        });
        console.log("✓ Default shipping zone created");
    }
}
