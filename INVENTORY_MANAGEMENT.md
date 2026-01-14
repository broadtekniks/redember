# Inventory & Stock Management - Best Practices

## Overview

This document outlines how product stock/quantity is managed in the Red Ember e-commerce system, following industry best practices inspired by Shopify's variant system.

## Understanding Product Variants

### What Are Variants?

**Variants are different versions of the same product** that differ by one or more attributes like:

- Size (2oz, 5oz, 8oz)
- Color (Red, Blue, Green)
- Heat Level (Mild, Medium, Hot)
- Material, Flavor, etc.

### How Variants Are Generated

The system uses **combinatorial variant generation** (Cartesian product):

**Example 1: Single Option**

```
Option: Size
Values: 2oz, 5oz, 8oz
Result: 3 variants
  → 2oz
  → 5oz
  → 8oz
```

**Example 2: Two Options (The "Overlap" Case)**

```
Option 1: Color
Values: Red, Blue

Option 2: Size
Values: 30ml, 50ml

Result: 4 variants (all combinations)
  → Red · 30ml
  → Red · 50ml
  → Blue · 30ml
  → Blue · 50ml
```

**Example 3: Three Options**

```
Option 1: Color (Red, Blue)
Option 2: Size (Small, Large)
Option 3: Material (Glass, Plastic)

Result: 8 variants (2 × 2 × 2)
  → Red · Small · Glass
  → Red · Small · Plastic
  → Red · Large · Glass
  → Red · Large · Plastic
  → Blue · Small · Glass
  → Blue · Small · Plastic
  → Blue · Large · Glass
  → Blue · Large · Plastic
```

### Why Variants "Overlap" (This Is Correct!)

When you have multiple options, the system creates **every possible combination**. This is not a bug—it's how variant systems work in Shopify, WooCommerce, and other platforms.

If you have:

- 3 colors
- 4 sizes
- 2 heat levels

You get: **3 × 4 × 2 = 24 total variants**

Each variant can have its own:

- Stock quantity
- Price
- SKU
- Images (via the group)

## Core Principle: SKU-Level Stock Tracking

**Stock is always tracked at the SKU (variant) level, never at a product group level.**

This follows the standard approach used by major e-commerce platforms (Shopify, WooCommerce, BigCommerce).

## How It Works

### Data Model

```
Product
  ├─ id: "red-ember-8oz-mild"
  ├─ sku: "RE-8OZ-MILD"
  ├─ stock: 50              ← Individual variant stock
  ├─ groupId: "chili-oil-1" ← Links to product group
  └─ variantName: "8oz"

Product
  ├─ id: "red-ember-16oz-mild"
  ├─ sku: "RE-16OZ-MILD"
  ├─ stock: 30              ← Individual variant stock
  ├─ groupId: "chili-oil-1" ← Same group
  └─ variantName: "16oz"
```

**Total stock across group = 50 + 30 = 80 units**

### Stock Management Rules

1. **Per-SKU Tracking**

   - Each variant (size, color, etc.) is a separate Product with its own `stock` field
   - Orders decrement stock from the specific variant purchased
   - Each SKU can have different stock levels

2. **Group Total** (Informational Only)

   - The "Total group stock" is calculated by summing all variant stocks
   - It's displayed for convenience but is NOT stored in the database
   - It updates automatically when individual variant stocks change

3. **Standalone Products** (No Variants)

   - Products without a `groupId` use simple stock tracking
   - One product = one stock number
   - Shows the traditional "Stock Quantity" input

4. **Grouped Products** (With Variants)
   - Stock must be managed in the "Stock by Variant (SKU)" table
   - The standalone "Stock Quantity" field is hidden
   - An info message directs users to the variant stock section

## Admin UI Workflow (Shopify-Style)

### Step 1: Create Product with Basic Info

1. Click "Add Product Variant"
2. Enter product name, base price, SKU prefix
3. Upload product images (shared across all variants)

### Step 2: Configure Variant Options

1. Click "Add option" to add a row
2. Select option type (Size, Color, Heat Level, etc.)
3. Enter values for that option (comma-separated)
   - Example: For Size, enter: `2oz, 5oz, 8oz`
   - Example: For Color, enter: `Red, Blue, Green`
4. Repeat for additional option types

**System automatically generates all combinations!**

### Step 3: Set Stock, Price, SKU Per Variant

The Variants table shows all generated combinations:

```
Variant          | Price ($) | Available | SKU                | Actions
----------------|-----------|-----------|--------------------|---------
Red · 2oz       | 10.00     | 50        | RE-BLZ-RED-2OZ    | 🗑️
Red · 5oz       | 18.00     | 30        | RE-BLZ-RED-5OZ    | 🗑️
Blue · 2oz      | 10.00     | 25        | RE-BLZ-BLUE-2OZ   | 🗑️
Blue · 5oz      | 18.00     | 40        | RE-BLZ-BLUE-5OZ   | 🗑️
```

- Each variant can have different stock
- Each variant can have different price
- Each variant gets unique SKU
- Click the delete (🗑️) button to exclude specific variants you don't want to create

**Total stock = 50 + 30 + 25 + 40 = 145 units**

#### Excluding Unwanted Variants

**If you don't want all combinations:**

1. Review the generated variants table
2. Click the delete icon (🗑️) next to any variant you don't want
3. Excluded variants won't be created when you save
4. Click "Restore All" if you change your mind

**Example:** If you have Red and Blue colors with 30ml and 50ml sizes, but you only stock:

- Red in 30ml
- Blue in 50ml

Simply delete "Red · 50ml" and "Blue · 30ml" from the table before saving.

### Step 4: Save

Click "Save & Keep Published" to create all variants at once.

## How to Avoid Too Many Variants

**Problem:** With 3 options of 4 values each, you get 64 variants!

**Solutions:**

1. **Delete Unwanted Variants**

   - Click the delete (🗑️) icon next to variants you don't want to create
   - The system generates all combinations, but you can exclude any before saving

2. **Reduce Options**

   - Only use options that customers truly need to choose
   - Don't make separate options for things that could be one option

3. **Reduce Values**

   - Limit sizes to 3-4 most popular
   - Limit colors to what you actually stock

4. **Split Into Separate Products**

   - Instead of one product with heat levels: Mild, Medium, Hot
   - Create: "Red Ember Chili Oil (Mild)", "Red Ember Chili Oil (Hot)"
   - Each can have size/color variants independently

5. **Use Description Instead**
   - If an attribute doesn't affect inventory/pricing
   - Put it in the description, not as a variant option

## Common Scenarios

### Scenario: Different Bottle Sizes Only

```
Options: Size → 2oz, 5oz, 8oz
Result: 3 variants
```

### Scenario: Different Colors and Sizes

```
Option 1: Color → Red, Blue
Option 2: Size → 30ml, 50ml
Result: 4 variants (all combinations)
  → Red · 30ml
  → Red · 50ml
  → Blue · 30ml
  → Blue · 50ml
```

This is the **"overlap" case** - it's correct! Each color comes in each size.

### Scenario: T-Shirt with Size and Color

```
Option 1: Size → S, M, L, XL
Option 2: Color → Black, White, Navy
Result: 12 variants (4 × 3)
```

You can stock different quantities per combination:

- Black · L: 100 units (most popular)
- Navy · XL: 10 units (less popular)

## Order Fulfillment Flow

When a customer orders:

1. Customer selects specific variant → e.g., "Red · 2oz"
2. Adds quantity to cart (e.g., 2 units)
3. At checkout, system checks: `stock >= 2` for that specific SKU
4. If available, decrement: `Product[red-2oz].stock -= 2`
5. Other variants' stock remains unchanged

## Database Schema

```prisma
model Product {
  id            String   @id
  sku           String   @unique
  stock         Int      @default(0)     // Stock for THIS variant/SKU
  groupId       String?                  // Links variants together
  variantName   String?                  // e.g., "Red · 2oz"
  // ... other fields
}

model ProductGroup {
  id      String    @id
  name    String
  // Note: No stock field! Stock lives in Product rows.
}
```

## Why This Approach?

### ✅ Advantages

- **Industry Standard**: Matches Shopify, WooCommerce, BigCommerce
- **Accurate**: Each SKU has its own inventory, preventing overselling
- **Flexible**: Different variants can have different stock levels
- **Customer Clarity**: Shoppers see exact availability per variant
- **Simple Database**: No complex stock allocation logic needed
- **Order Management**: Easy to track which specific variant sold

### ❌ Alternatives (Not Recommended)

- **Group-level stock with allocation**: Complex, error-prone, not standard
- **Manual distribution**: Requires additional UI and validation
- **Shared pool**: Can't differentiate between variant availability

## Quick Reference

### Calculating Number of Variants

**Formula:** Multiply the number of values across all options

```
Options:
  Color: 3 values (Red, Blue, Green)
  Size: 4 values (S, M, L, XL)

Total variants = 3 × 4 = 12
```

### Maximum Recommended Variants

- **1-10 variants**: Excellent (easy to manage)
- **10-25 variants**: Good (manageable)
- **25-50 variants**: Acceptable (requires attention)
- **50+ variants**: Consider splitting into multiple products

### FAQ

**Q: I entered "Red, Blue" for Color and "30ml, 50ml" for Size. Why do I see 4 variants instead of 2?**

A: The system creates **all combinations** (Cartesian product). This is correct behavior:

- Red · 30ml
- Red · 50ml (← this is the "overlap")
- Blue · 30ml
- Blue · 50ml (← this is the "overlap")

This matches how Shopify, Amazon, and other platforms work.

**Q: Can I have different stock for each variant?**

A: Yes! That's the whole point. Each variant has its own stock field.

**Q: Can I have different prices for each variant?**

A: Yes! Each variant has its own price field in the Variants table.

**Q: How do I reduce the number of variants?**

A:

1. Click the delete (🗑️) button next to specific variants you don't want
2. Remove option rows you don't need
3. Delete values from options (click the X on value chips)
4. Consider splitting into separate products

**Q: What if I only want Red in 30ml and Blue in 50ml (no overlap)?**

A: **Option 1 (Recommended):** Delete unwanted variants:

1. Let the system generate all 4 combinations
2. Click delete on "Red · 50ml" and "Blue · 30ml"
3. Only "Red · 30ml" and "Blue · 50ml" will be created

**Option 2:** Create two separate products:

- Product 1: "Red Ember - Red Edition" with Size: 30ml
- Product 2: "Red Ember - Blue Edition" with Size: 50ml

Don't use both Color and Size as options if you don't want all combinations.

**Q: I accidentally deleted a variant. How do I get it back?**

A: Click the "Restore All" button that appears when variants are excluded. This brings back all deleted variants. Then you can delete only the ones you don't want again.

**Q: What happens to deleted variants in edit mode?**

A: In create mode, deleted variants simply won't be created. The delete function is for removing unwanted combinations before saving for the first time. In edit mode, you would need to delete actual product records through the product list.

## Best Practices for Users

1. **Set realistic stock per variant**

   - Small sizes might have higher stock than large sizes
   - Popular colors should have more inventory

2. **Monitor low stock alerts**

   - System flags variants with stock ≤ 10 units
   - Restock before reaching zero

3. **Use groups correctly**

   - Group variants that share media/descriptions
   - Each size/color = separate SKU = separate stock

4. **Bulk editing**
   - Edit mode allows changing stock for all variants at once
   - Saves time when receiving new inventory shipments

## Future Enhancements (Optional)

- **Stock history**: Track stock changes over time
- **Reorder points**: Auto-alert when stock hits threshold
- **Multi-location inventory**: Track stock across warehouses
- **Reserved stock**: Hold stock during checkout process
- **Backorder support**: Accept orders when out of stock
