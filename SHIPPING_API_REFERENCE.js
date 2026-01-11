/*
  SHIPPING COST CALCULATION - QUICK REFERENCE

  This file is documentation-only. It intentionally does not execute anything.
  The examples are structured as valid JavaScript so editors/linters don't flag
  parse errors.
*/

// ============================================
// 1. PRODUCT WEIGHT FIELDS (choose one or more)
// ============================================

// Example product weight fields (choose one or more)
const productWeightExamples = {
  // Option A: Weight in ounces (US products)
  weightOz: 2.5, // 2.5 oz bottle

  // Option B: Weight in grams (decimal precision)
  weightG: 70.8, // 70.8g bottle

  // Option C: Volume in milliliters (liquids)
  volumeMl: 50, // 50ml bottle

  // Option D: Legacy integer weight
  weightGrams: 71, // 71g (for backward compatibility)
};

// ============================================
// 2. FRONTEND: Calculate Shipping for Cart
// ============================================

// import { calculateShipping } from "../lib/api";

const cartItems = [
  { productId: "red-ember-original", quantity: 2 },
  { productId: "red-ember-spicy", quantity: 1 },
];

async function exampleCalculateShipping() {
  // const shippingInfo = await calculateShipping(cartItems, "US");
  // console.log(shippingInfo);
}
// Returns:
// {
//   shippingCents: 875,      // $8.75
//   totalWeightG: 425,       // 425 grams total
//   freeShippingMin: 7500,   // $75 threshold
//   zone: "United States"
// }

// ============================================
// 3. BACKEND: Shipping Calculation Logic
// ============================================

// Weight priority (from highest to lowest):
// 1. weightG (most precise)
// 2. weightOz → convert to grams (oz × 28.3495)
// 3. weightGrams (legacy)
// 4. volumeMl (assume 1ml ≈ 1g)
// 5. Default 250g if none specified

// Example calculation:
const product = {
  weightOz: 2.5, // User entered 2.5 oz
};

const weightG = product.weightOz * 28.3495; // = 70.87 grams

// Find matching tier:
// 0-250g: $4.50
// 251-750g: $8.75  ← matches 70.87g
// 751-2000g: $12.00

const shippingCost = 450; // cents

/*
// ============================================
// 4. ADMIN: Manage Shipping Configuration
// ============================================

import { adminGetShipping, adminUpdateShippingZone } from "../lib/api";

// Get current configuration
const { zones } = await adminGetShipping();

// Update a zone
await adminUpdateShippingZone(zones[0].id, {
  name: "United States",
  countries: ["US"],
  enabled: true,
  freeShippingMin: 7500, // $75.00 in cents
  weightTiers: [
    { minWeightG: 0, maxWeightG: 250, rateCents: 450 },    // $4.50
    { minWeightG: 251, maxWeightG: 750, rateCents: 875 },  // $8.75
    { minWeightG: 751, maxWeightG: 2000, rateCents: 1200 }, // $12.00
  ],
});

// ============================================
// 5. DATABASE QUERIES
// ============================================

// Get shipping zone with tiers
const zone = await prisma.shippingZone.findFirst({
  where: { enabled: true, countries: { has: "US" } },
  include: { weightTiers: { orderBy: { minWeightG: "asc" } } },
});

// Create new shipping zone
await prisma.shippingZone.create({
  data: {
    name: "Canada",
    countries: ["CA"],
    enabled: true,
    freeShippingMin: 10000, // $100 CAD
    weightTiers: {
      create: [
        { minWeightG: 0, maxWeightG: 500, rateCents: 1200 },
        { minWeightG: 501, maxWeightG: 2000, rateCents: 1800 },
      ],
    },
  },
});

// ============================================
// 6. CONVERSIONS
// ============================================

// Ounces to Grams
const grams = ounces * 28.3495;
// Example: 2.5 oz = 70.87g

// Grams to Ounces
const ounces = grams / 28.3495;
// Example: 71g = 2.50 oz

// Milliliters to Grams (water-based)
const grams = milliliters * 1.0;
// Example: 50ml ≈ 50g

// Cents to Dollars
const dollars = cents / 100;
// Example: 875 cents = $8.75

// Dollars to Cents
const cents = Math.round(dollars * 100);
// Example: $8.75 = 875 cents

// ============================================
// 7. TYPICAL PRODUCT WEIGHTS
// ============================================

// Red Ember Chili Oil Bottles:
// - 50ml bottle: ~70g total (50g oil + 20g glass)
// - 70ml bottle: ~95g total (70g oil + 25g glass)
// - 100ml bottle: ~135g total (100g oil + 35g glass)

// Packaging:
// - Bubble wrap: ~10g per bottle
// - Box (small): ~50g
// - Box (medium): ~100g

// Total shipping weights:
// - 1x 50ml: 70 + 10 = 80g → Tier 1 ($4.50)
// - 3x 50ml: 240g + 50g box = 290g → Tier 2 ($8.75)
// - 6x 70ml: 570g + 100g box = 670g → Tier 2 ($8.75)
// - 10x 70ml: 950g + 100g box = 1050g → Tier 3 ($12.00)

// ============================================
// 8. FREE SHIPPING LOGIC
// ============================================

// Check if free shipping applies
const subtotalCents = 8500; // $85.00
const freeShippingMin = 7500; // $75.00

if (subtotalCents >= freeShippingMin) {
  shippingCost = 0; // FREE!
} else {
  const needToAdd = freeShippingMin - subtotalCents;
  // Show: "Add $X.XX more for free shipping!"
}

// ============================================
// 9. ERROR HANDLING
// ============================================

try {
  const shipping = await calculateShipping(items, "US");
} catch (error) {
  // Fallback to default rates
  const defaultShipping = subtotal >= 5000 ? 0 : 599; // $5.99
}

// ============================================
// 10. TESTING SCENARIOS
// ============================================

// Test Case 1: Single small bottle
const cart1 = [{ productId: "bottle-50ml", quantity: 1 }];
// Expected: $4.50 shipping (0-250g tier)

// Test Case 2: Three bottles
const cart2 = [{ productId: "bottle-50ml", quantity: 3 }];
// Expected: $8.75 shipping (251-750g tier)

// Test Case 3: Free shipping threshold
const cart3 = [{ productId: "bottle-50ml", quantity: 10 }]; // $75+ subtotal
// Expected: $0.00 shipping (FREE)

// Test Case 4: International
const cart4 = [{ productId: "bottle-50ml", quantity: 2 }];
const shipping = await calculateShipping(cart4, "CA"); // Canada
// Expected: Fallback to default or create Canada zone

*/
