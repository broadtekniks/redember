# Media Library Architecture

## Overview

The media library implements a WordPress/Strapi-style centralized asset management system where images are stored once and can be referenced multiple times across different content types (products, categories, future blog posts, etc.).

## Architecture: Separate Media Table (Option 3)

### Benefits
- ✅ **True Reusability**: One image can be used in products, categories, blogs without duplication
- ✅ **Storage Efficiency**: Each image stored once in Cloudflare R2
- ✅ **Centralized Management**: Update alt text/metadata in one place
- ✅ **Usage Tracking**: Know which assets are in use and where
- ✅ **Bulk Operations**: Delete unused media, find orphaned assets

### Database Schema

```prisma
model Media {
  id        String   @id @default(cuid())
  url       String   @unique
  filename  String?
  size      Int?
  mimeType  String?
  alt       String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  productImages ProductImage[]
}

model ProductImage {
  id         String  @id @default(cuid())
  mediaId    String
  media      Media   @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  productId  String?
  categoryId String?
  alt        String?
  isMain     Boolean @default(false)
  sortOrder  Int     @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  product  Product?         @relation(fields: [productId], references: [id], onDelete: Cascade)
  category ProductCategory? @relation(fields: [categoryId], references: [id], onDelete: Cascade)
}
```

### Data Flow

#### Upload Flow
1. User uploads image to Cloudflare R2
2. R2 returns public URL
3. Create `Media` record with:
   - url (unique)
   - filename
   - size
   - mimeType
   - alt (optional)
4. If URL already exists, return existing Media record (no duplicates)

#### Assignment Flow
1. User selects image(s) from media library (by ID)
2. Create `ProductImage` record with:
   - mediaId (foreign key)
   - productId or categoryId
   - isMain
   - sortOrder
3. Join with `Media` table to display URL

#### Deletion Flow
- Deleting ProductImage: Only removes reference, keeps Media
- Deleting Product/Category: Cascade deletes ProductImage references, keeps Media
- Deleting Media: Cascade deletes all ProductImage references (use with caution!)

## API Endpoints

### Media Management

**GET /api/admin/media**
```typescript
// Returns all media with usage statistics
[
  {
    id: "cm59abc123",
    url: "https://r2.example.com/image.jpg",
    filename: "product-shot.jpg",
    size: 245678,
    mimeType: "image/jpeg",
    alt: "Red hot sauce bottle",
    createdAt: "2025-01-14T12:00:00Z",
    updatedAt: "2025-01-14T12:00:00Z",
    isUsed: true,
    usageCount: 3,
    productImages: [...]
  }
]
```

**POST /api/admin/media**
```typescript
// Create new media record (or return existing)
{
  url: "https://r2.example.com/new-image.jpg",
  filename: "sauce.jpg",
  size: 123456,
  mimeType: "image/jpeg",
  alt: "Artisan hot sauce"
}
```

### Product Images

**GET /api/admin/products/:productId/images**
```typescript
// Returns product images with media data
[
  {
    id: "pi_123",
    mediaId: "cm59abc123",
    productId: "habanero-fire",
    isMain: true,
    sortOrder: 0,
    media: {
      id: "cm59abc123",
      url: "https://r2.example.com/image.jpg",
      filename: "habanero.jpg",
      alt: "Habanero sauce bottle"
    }
  }
]
```

**POST /api/admin/products/:productId/images**
```typescript
// Add image to product (by media ID)
{
  mediaId: "cm59abc123",
  isMain: true
}
```

**PATCH /api/admin/products/:productId/images/:id**
```typescript
// Update isMain/sortOrder only (doesn't modify media)
{
  isMain: false,
  sortOrder: 2
}
```

**DELETE /api/admin/products/:productId/images/:id**
```typescript
// Remove image from product (keeps media)
// Returns: { ok: true }
```

### Category Images
Same pattern as product images:
- GET /api/admin/categories/:categoryId/images
- POST /api/admin/categories/:categoryId/images
- PATCH /api/admin/categories/:categoryId/images/:id
- DELETE /api/admin/categories/:categoryId/images/:id

## Frontend Components

### MediaGallery Component

**Props**
```typescript
interface MediaGalleryProps {
  onClose: () => void;
  onSelect: (mediaIds: string[]) => void; // Returns media IDs, not URLs
  multiSelect?: boolean;
}
```

**Features**
- Upload images to R2 and save to Media table
- Browse all media with visual grid
- Search/filter by filename
- Multi-select mode
- Usage badges showing if/how many times media is used
- Auto-select uploaded images

**Usage**
```tsx
<MediaGallery
  onClose={() => setShowMediaGallery(false)}
  onSelect={(mediaIds) => {
    // Fetch media details and add to product
    handleMediaGallerySelect(mediaIds);
  }}
  multiSelect={true}
/>
```

### AdminInventory Integration

**Product Image State**
```typescript
interface ProductImage {
  id: string;
  mediaId: string; // Foreign key to Media
  url: string;     // For display (from media.url)
  alt?: string;
  isMain: boolean;
  sortOrder: number;
}
```

**Selection Flow**
1. User clicks "Add Media" → Opens MediaGallery
2. MediaGallery returns mediaIds: `["cm59abc123", "cm59xyz789"]`
3. Fetch media details from API to get URLs
4. Create temp ProductImage records with mediaId + url
5. On save, send mediaId to backend (not url)

## Migration Path

### Database Migration
```bash
npx prisma migrate dev --name add_media_table
```

This migration:
1. Creates `Media` table
2. Adds `mediaId` to `ProductImage`
3. Makes `url` optional on `ProductImage`
4. Adds foreign key constraint with CASCADE delete

### Existing Data
- Old ProductImage records with `url` but no `mediaId` still work
- New records use mediaId-based architecture
- Gradual migration: Could batch-import existing URLs into Media table

## Future Enhancements

### Planned Features
- [ ] Bulk media upload
- [ ] Image editing (crop, resize, filters)
- [ ] Alt text AI generation
- [ ] Image optimization/compression
- [ ] Folder/tag organization
- [ ] Advanced search (by size, date, usage)
- [ ] Unused media detection & cleanup

### Blog Post Integration
When blog feature is added:
```prisma
model BlogPost {
  id          String   @id @default(cuid())
  title       String
  content     String
  featuredImageId String?
  featuredImage Media? @relation(fields: [featuredImageId], references: [id])
}

model BlogPostImage {
  id          String   @id @default(cuid())
  mediaId     String
  media       Media    @relation(fields: [mediaId], references: [id])
  blogPostId  String
  blogPost    BlogPost @relation(fields: [blogPostId], references: [id])
  sortOrder   Int      @default(0)
}
```

Same pattern: reference Media by ID, join to get URL.

## Best Practices

### DO
✅ Always check if Media exists before creating ProductImage
✅ Use mediaId when creating/updating ProductImage
✅ Join with Media table when fetching images for display
✅ Show usage statistics in media library
✅ Validate Media.url uniqueness before upload

### DON'T
❌ Store URLs in multiple places (use mediaId references)
❌ Delete Media records without checking usage
❌ Upload duplicate images (check existing by URL)
❌ Update Media.url (create new record instead)
❌ Cascade delete Media unless intentional

## Performance Considerations

### Indexes
- `Media.url` is UNIQUE (automatic index)
- `ProductImage.mediaId` has foreign key index
- Consider adding index on `ProductImage.productId` if not already indexed

### Queries
- Use `include: { media: true }` sparingly (only when URL needed)
- For listing products, fetch images separately if needed
- Consider pagination for media library (currently loads all)

### Caching
- Media URLs are immutable (R2 URL never changes)
- Cache media lookups at application level
- Consider CDN caching for R2 public URLs

## Troubleshooting

### "Media not found" error
- Check mediaId is correct
- Verify Media record exists in database
- Ensure mediaId is passed (not url)

### Duplicate images uploading
- Check uniqueness constraint on Media.url
- Verify upload handler returns existing Media if URL exists
- Look for failed Media creation attempts

### Orphaned media
- Query: `SELECT * FROM Media WHERE id NOT IN (SELECT DISTINCT mediaId FROM ProductImage WHERE mediaId IS NOT NULL)`
- Consider periodic cleanup job
- Add "Delete unused media" feature to admin panel

### Missing images on frontend
- Verify `include: { media: true }` in Prisma query
- Check ProductImage has valid mediaId
- Ensure Media.url is accessible from frontend
