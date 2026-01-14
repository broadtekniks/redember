import { useEffect, useState } from "react";
import {
  adminGetCategoryImages,
  adminAddCategoryImage,
  adminDeleteCategoryImage,
  adminReorderCategoryImages,
  adminUploadImage,
} from "../lib/api";
import { ProductImage } from "../types";

interface ImageGalleryProps {
  categoryId: string | null;
  onSelectMain: (url: string) => void;
  currentMainImage?: string;
}

export default function ImageGallery({
  categoryId,
  onSelectMain,
  currentMainImage,
}: ImageGalleryProps) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (categoryId) {
      loadImages();
    } else {
      setImages([]);
    }
  }, [categoryId]);

  async function loadImages(): Promise<void> {
    if (!categoryId) return;
    setLoading(true);
    setError("");
    try {
      const data = await adminGetCategoryImages(categoryId);
      setImages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const files = e.target.files;
    if (!files || files.length === 0 || !categoryId) return;

    const filesArray = Array.from(files);
    const availableSlots = 10 - images.length;

    if (filesArray.length > availableSlots) {
      setError(
        `Can only upload ${availableSlots} more image(s). Maximum 10 images allowed.`
      );
      return;
    }

    setUploading(true);
    setError("");
    let firstUploadedUrl: string | null = null;

    try {
      // Upload all files sequentially
      for (const file of filesArray) {
        const { url } = await adminUploadImage(file);
        await adminAddCategoryImage(categoryId, { url });
        if (!firstUploadedUrl) firstUploadedUrl = url;
      }

      await loadImages();

      // If this was the first image, set it as main
      if (images.length === 0 && firstUploadedUrl) {
        onSelectMain(firstUploadedUrl);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(imageId: string): Promise<void> {
    if (!categoryId) return;
    setError("");
    try {
      await adminDeleteCategoryImage(categoryId, imageId);
      await loadImages();

      // If deleted image was the main one, select the first remaining image
      const deletedImage = images.find((img) => img.id === imageId);
      if (deletedImage?.url === currentMainImage && images.length > 1) {
        const remaining = images.filter((img) => img.id !== imageId);
        if (remaining.length > 0) {
          onSelectMain(remaining[0].url);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleMoveUp(index: number): Promise<void> {
    if (index === 0 || !categoryId) return;

    const newImages = [...images];
    [newImages[index - 1], newImages[index]] = [
      newImages[index],
      newImages[index - 1],
    ];

    const updates = newImages.map((img, idx) => ({
      id: img.id,
      sortOrder: idx,
    }));

    try {
      await adminReorderCategoryImages(categoryId, updates);
      setImages(newImages);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleMoveDown(index: number): Promise<void> {
    if (index === images.length - 1 || !categoryId) return;

    const newImages = [...images];
    [newImages[index], newImages[index + 1]] = [
      newImages[index + 1],
      newImages[index],
    ];

    const updates = newImages.map((img, idx) => ({
      id: img.id,
      sortOrder: idx,
    }));

    try {
      await adminReorderCategoryImages(categoryId, updates);
      setImages(newImages);
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (!categoryId) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center text-sm text-slate-500">
        Select or create a product category to manage images
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">
          <p className="text-xs text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Product Images ({images.length}/10)
        </p>
        <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer transition-colors text-xs font-medium">
          <span className="material-symbols-outlined text-sm">
            {uploading ? "hourglass_empty" : "add_photo_alternate"}
          </span>
          {uploading ? "Uploading..." : "Add Image"}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={uploading || images.length >= 10}
            className="hidden"
          />
        </label>
      </div>

      {loading ? (
        <div className="text-center py-8 text-sm text-slate-500">
          Loading images...
        </div>
      ) : images.length === 0 ? (
        <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">
            add_photo_alternate
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No images yet. Upload up to 10 images.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((image, index) => {
            const isMain =
              image.url === currentMainImage ||
              (index === 0 && !currentMainImage);

            return (
              <div
                key={image.id}
                className={`relative group rounded-lg overflow-hidden border-2 ${
                  isMain
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="aspect-square bg-slate-100 dark:bg-slate-800">
                  <img
                    src={image.url}
                    alt={image.alt || "Product"}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectMain(image.url)}
                    disabled={isMain}
                    className="p-1.5 bg-white dark:bg-slate-800 rounded-md hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                    title="Set as main image"
                  >
                    <span className="material-symbols-outlined text-sm">
                      star
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1.5 bg-white dark:bg-slate-800 rounded-md hover:bg-primary hover:text-white transition-colors disabled:opacity-30"
                    title="Move up"
                  >
                    <span className="material-symbols-outlined text-sm">
                      arrow_upward
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === images.length - 1}
                    className="p-1.5 bg-white dark:bg-slate-800 rounded-md hover:bg-primary hover:text-white transition-colors disabled:opacity-30"
                    title="Move down"
                  >
                    <span className="material-symbols-outlined text-sm">
                      arrow_downward
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(image.id)}
                    className="p-1.5 bg-white dark:bg-slate-800 text-red-600 rounded-md hover:bg-red-600 hover:text-white transition-colors"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-sm">
                      delete
                    </span>
                  </button>
                </div>

                {isMain && (
                  <div className="absolute top-1 left-1 bg-primary text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">
                      star
                    </span>
                    MAIN
                  </div>
                )}

                <div className="absolute bottom-1 left-1 bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
                  #{index + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        The first image (marked with star) is the main product image. Use arrows
        to reorder.
      </p>
    </div>
  );
}
