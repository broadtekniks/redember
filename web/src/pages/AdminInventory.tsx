import React, { useEffect, useMemo, useState } from "react";
import {
  adminCreateCategory,
  adminCreateProduct,
  adminDeleteProduct,
  adminCategories,
  adminProducts,
  adminUpdateProduct,
  adminGetProductImages,
  adminAddProductImage,
  adminUpdateProductImage,
  adminDeleteProductImage,
} from "../lib/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Product, ProductCategory } from "../types";
import { MediaGallery } from "../components/MediaGallery";

const LOW_STOCK_THRESHOLD = 10;

function formatMoney(cents: number, currency: string = "usd"): string {
  const value = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

interface StockStatus {
  label: string;
  kind: "in" | "low" | "out" | "inactive";
}

function statusForStock(stock: number, active: boolean): StockStatus {
  if (!active) return { label: "Inactive", kind: "inactive" };
  if (stock === 0) return { label: "Out of Stock", kind: "out" };
  if (stock <= LOW_STOCK_THRESHOLD) return { label: "Low Stock", kind: "low" };
  return { label: "In Stock", kind: "in" };
}

function downloadCsv(
  filename: string,
  rows: (string | number | boolean)[][]
): void {
  const escape = (v: string | number | boolean | null | undefined): string => {
    const s = String(v ?? "");
    if (/[\",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function makeIdFromName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

interface ProductFormData {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  active: boolean;
  sku: string;
  variantName: string;
  priceCents: number | string;
  currency: string;
  stock: number | string;
  requiresShipping: boolean;
  weightGrams: number | string;
  weightOz: number | string;
  weightG: number | string;
  volumeMl: number | string;
  lengthMm: number | string;
  widthMm: number | string;
  heightMm: number | string;
}

interface ProductModalProps {
  mode: "create" | "edit";
  categories: ProductCategory[];
  initial: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

function ProductModal({
  mode,
  categories,
  initial,
  onClose,
  onSaved,
}: ProductModalProps) {
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [form, setForm] = useState<ProductFormData>(() => {
    const p: Partial<Product> = initial ?? {};
    return {
      id: p.id || "",
      name: p.name || "",
      description: p.description || "",
      imageUrl: p.imageUrl || "",
      categoryId: p.categoryId || "",
      active: typeof p.active === "boolean" ? p.active : true,
      sku: p.sku || "",
      variantName: p.variantName || "",
      priceCents:
        typeof p.priceCents === "number" && Number.isInteger(p.priceCents)
          ? p.priceCents
          : 0,
      currency: p.currency || "usd",
      stock:
        typeof p.stock === "number" && Number.isInteger(p.stock) ? p.stock : 0,
      requiresShipping:
        typeof p.requiresShipping === "boolean" ? p.requiresShipping : true,
      weightGrams: p.weightGrams ?? "",
      weightOz: p.weightOz ?? "",
      weightG: p.weightG ?? "",
      volumeMl: p.volumeMl ?? "",
      lengthMm: p.lengthMm ?? "",
      widthMm: p.widthMm ?? "",
      heightMm: p.heightMm ?? "",
    };
  });

  // Image gallery state
  interface ProductImage {
    id: string;
    mediaId: string;
    url: string; // For display purposes - from media object
    alt?: string;
    isMain: boolean;
    sortOrder: number;
  }

  const [images, setImages] = useState<ProductImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showMediaGallery, setShowMediaGallery] = useState<boolean>(false);

  const [newCategoryName, setNewCategoryName] = useState<string>("");

  // Variant Type management
  interface VariantOption {
    id: string;
    value: string;
  }

  interface VariantType {
    id: string;
    name: string;
    options: VariantOption[];
  }

  const [variantTypes, setVariantTypes] = useState<VariantType[]>([
    {
      id: "1",
      name: "Size",
      options: [
        { id: "1-1", value: "50ml" },
        { id: "1-2", value: "170ml" },
      ],
    },
  ]);

  const [newVariantTypeName, setNewVariantTypeName] = useState<string>("");
  const [editingVariantType, setEditingVariantType] = useState<string | null>(
    null
  );

  const addVariantType = () => {
    if (!newVariantTypeName.trim()) return;
    const newType: VariantType = {
      id: Date.now().toString(),
      name: newVariantTypeName.trim(),
      options: [],
    };
    setVariantTypes([...variantTypes, newType]);
    setNewVariantTypeName("");
  };

  const removeVariantType = (id: string) => {
    setVariantTypes(variantTypes.filter((vt) => vt.id !== id));
  };

  const updateVariantTypeName = (id: string, name: string) => {
    setVariantTypes(
      variantTypes.map((vt) => (vt.id === id ? { ...vt, name } : vt))
    );
  };

  const addVariantOption = (typeId: string) => {
    setVariantTypes(
      variantTypes.map((vt) => {
        if (vt.id === typeId) {
          return {
            ...vt,
            options: [
              ...vt.options,
              { id: `${typeId}-${Date.now()}`, value: "" },
            ],
          };
        }
        return vt;
      })
    );
  };

  const removeVariantOption = (typeId: string, optionId: string) => {
    setVariantTypes(
      variantTypes.map((vt) => {
        if (vt.id === typeId) {
          return {
            ...vt,
            options: vt.options.filter((opt) => opt.id !== optionId),
          };
        }
        return vt;
      })
    );
  };

  const updateVariantOption = (
    typeId: string,
    optionId: string,
    value: string
  ) => {
    setVariantTypes(
      variantTypes.map((vt) => {
        if (vt.id === typeId) {
          return {
            ...vt,
            options: vt.options.map((opt) =>
              opt.id === optionId ? { ...opt, value } : opt
            ),
          };
        }
        return vt;
      })
    );
  };

  // Product Variants (actual SKUs generated from variant types)
  interface ProductVariant {
    id: string;
    combination: { [typeId: string]: string }; // typeId -> option value
    sku: string;
    price: number;
    stock: number;
  }

  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);

  // Generate all combinations from variant types
  const generateVariantCombinations = () => {
    const typesWithOptions = variantTypes.filter((vt) => vt.options.length > 0);

    if (typesWithOptions.length === 0) {
      setProductVariants([]);
      return;
    }

    const combinations: ProductVariant[] = [];

    const generate = (index: number, current: { [key: string]: string }) => {
      if (index === typesWithOptions.length) {
        const basePrice = Number(form.priceCents) / 100 || 0;

        combinations.push({
          id: Date.now().toString() + Math.random(),
          combination: current,
          sku: "",
          price: basePrice,
          stock: 0,
        });
        return;
      }

      const variantType = typesWithOptions[index];
      for (const option of variantType.options) {
        if (option.value.trim()) {
          generate(index + 1, {
            ...current,
            [variantType.id]: option.value,
          });
        }
      }
    };

    generate(0, {});
    setProductVariants(combinations);
  };

  const updateProductVariant = (
    id: string,
    field: keyof ProductVariant,
    value: any
  ) => {
    setProductVariants(
      productVariants.map((pv) =>
        pv.id === id ? { ...pv, [field]: value } : pv
      )
    );
  };

  const removeProductVariant = (id: string) => {
    setProductVariants(productVariants.filter((pv) => pv.id !== id));
  };

  // Load existing product images in edit mode
  useEffect(() => {
    if (mode === "edit" && initial?.id) {
      adminGetProductImages(initial.id)
        .then((imgs) => {
          setImages(imgs || []);
        })
        .catch((err) => {
          console.error("Failed to load product images:", err);
        });
    }
  }, [mode, initial?.id]);

  function toggleImageSelection(imageId: string) {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId);
    } else {
      newSelection.add(imageId);
    }
    setSelectedImages(newSelection);
  }

  function deleteSelectedImages() {
    const newImages = images.filter((img) => !selectedImages.has(img.id));

    // If we deleted the main image, set the first remaining image as main
    const hasMainImage = newImages.some((img) => img.isMain);
    if (!hasMainImage && newImages.length > 0) {
      newImages[0].isMain = true;
    }

    setImages(newImages);
    setSelectedImages(new Set());
  }

  function setMainImage(imageId: string) {
    setImages(
      images.map((img) => ({
        ...img,
        isMain: img.id === imageId,
      }))
    );
    setSelectedImages(new Set());
  }

  function handleMediaGallerySelect(mediaIds: string[]) {
    // Check if adding these images would exceed the limit
    if (images.length + mediaIds.length > 10) {
      setError(`Maximum 10 images allowed per product. You can add ${10 - images.length} more.`);
      setShowMediaGallery(false);
      return;
    }

    // Fetch media details from the API to get the URL
    const fetchMediaDetails = async () => {
      try {
        const response = await fetch('/api/admin/media');
        if (!response.ok) throw new Error('Failed to fetch media');
        const allMedia = await response.json();

        const newImages: ProductImage[] = mediaIds
          .map((mediaId, index) => {
            const media = allMedia.find((m: any) => m.id === mediaId);
            if (!media) return null;

            return {
              id: `temp-${Date.now()}-${index}`,
              mediaId: mediaId,
              url: media.url,
              alt: media.alt || "",
              isMain: images.length === 0 && index === 0,
              sortOrder: images.length + index,
            };
          })
          .filter(Boolean) as ProductImage[];

        setImages([...images, ...newImages]);
        setShowMediaGallery(false);
      } catch (err: any) {
        setError(err.message);
        setShowMediaGallery(false);
      }
    };

    fetchMediaDetails();
  }

  async function createCategoryIfNeeded(): Promise<ProductCategory | null> {
    const name = newCategoryName.trim();
    if (!name) return null;
    const handle = makeIdFromName(name);
    if (!handle) throw new Error("Category handle could not be generated");
    const category = await adminCreateCategory({ name, handle });
    setNewCategoryName("");
    return category;
  }

  async function onSubmit(): Promise<void> {
    setError("");

    // Validation
    if (!form.name.trim()) {
      setError("Product name is required");
      return;
    }

    if (productVariants.length > 0) {
      // Validate variants
      const invalidVariants = productVariants.filter((v) => !v.sku.trim());
      if (invalidVariants.length > 0) {
        setError(
          `Please provide SKUs for all ${productVariants.length} variants`
        );
        return;
      }
    } else {
      // Validate single product
      if (!form.sku.trim() && mode === "create") {
        setError("SKU is required for products without variants");
        return;
      }
    }

    setSaving(true);
    try {
      const createdCategory = await createCategoryIfNeeded();
      const categoryId =
        createdCategory?.id || (form.categoryId ? form.categoryId : null);

      // If there are product variants (generated SKUs), create multiple products
      if (productVariants.length > 0) {
        // Create a product for each variant
        for (const variant of productVariants) {
          const variantLabel = Object.values(variant.combination).join(" / ");

          const payload = {
            id:
              variant.sku.trim() ||
              makeIdFromName(`${form.name} ${variantLabel}`),
            name: `${form.name.trim()} - ${variantLabel}`,
            sku:
              variant.sku.trim() ||
              `SKU-${variantLabel.replace(/\s/g, "-").toUpperCase()}`,
            groupId: categoryId,
            variantName: variantLabel,
            priceCents: Math.round(variant.price * 100),
            currency: (form.currency || "usd").trim().toLowerCase(),
            stock: variant.stock,
            active: !!form.active,
            imageUrl: form.imageUrl.trim() || null,
            description: form.description || null,
            requiresShipping: !!form.requiresShipping,
            weightGrams:
              form.weightGrams === ""
                ? null
                : parseInt(String(form.weightGrams), 10),
            weightOz:
              form.weightOz === "" ? null : parseFloat(String(form.weightOz)),
            weightG:
              form.weightG === "" ? null : parseFloat(String(form.weightG)),
            volumeMl:
              form.volumeMl === "" ? null : parseFloat(String(form.volumeMl)),
            lengthMm:
              form.lengthMm === "" ? null : parseInt(String(form.lengthMm), 10),
            widthMm:
              form.widthMm === "" ? null : parseInt(String(form.widthMm), 10),
            heightMm:
              form.heightMm === "" ? null : parseInt(String(form.heightMm), 10),
          };

          if (mode === "create") {
            await adminCreateProduct(payload);
          }
        }
      } else {
        // No variants - create a single product
        const payload = {
          id: form.id.trim(),
          name: form.name.trim(),
          sku: form.sku.trim(),
          groupId: categoryId,
          variantName: form.variantName.trim() || null,
          priceCents: parseInt(String(form.priceCents), 10),
          currency: (form.currency || "usd").trim().toLowerCase(),
          stock: parseInt(String(form.stock), 10),
          active: !!form.active,
          imageUrl: form.imageUrl.trim() || null,
          description: form.description || null,
          requiresShipping: !!form.requiresShipping,
          weightGrams:
            form.weightGrams === ""
              ? null
              : parseInt(String(form.weightGrams), 10),
          weightOz:
            form.weightOz === "" ? null : parseFloat(String(form.weightOz)),
          weightG:
            form.weightG === "" ? null : parseFloat(String(form.weightG)),
          volumeMl:
            form.volumeMl === "" ? null : parseFloat(String(form.volumeMl)),
          lengthMm:
            form.lengthMm === "" ? null : parseInt(String(form.lengthMm), 10),
          widthMm:
            form.widthMm === "" ? null : parseInt(String(form.widthMm), 10),
          heightMm:
            form.heightMm === "" ? null : parseInt(String(form.heightMm), 10),
        };

        if (mode === "create") {
          if (!payload.id) payload.id = makeIdFromName(payload.name);
          await adminCreateProduct(payload);
        } else {
          await adminUpdateProduct(initial!.id, payload);
        }

        // Save product images (only for single product, not variants)
        if (mode === "create" || mode === "edit") {
          const productId = mode === "create" ? payload.id : initial!.id;

          // Get existing images if editing
          let existingImages: any[] = [];
          if (mode === "edit") {
            try {
              existingImages = await adminGetProductImages(productId);
            } catch (err) {
              console.error("Failed to load existing images:", err);
            }
          }

          // Delete removed images
          const currentImageIds = new Set(
            images
              .filter((img) => !img.id.startsWith("temp-"))
              .map((img) => img.id)
          );

          for (const existingImage of existingImages) {
            if (!currentImageIds.has(existingImage.id)) {
              try {
                await adminDeleteProductImage(productId, existingImage.id);
              } catch (err) {
                console.error("Failed to delete image:", err);
              }
            }
          }

          // Add new images (ones with temp- ids)
          const newImages = images.filter((img) => img.id.startsWith("temp-"));
          for (const image of newImages) {
            try {
              await adminAddProductImage(productId, {
                mediaId: image.mediaId,
                isMain: image.isMain,
              });
            } catch (err) {
              console.error("Failed to add image:", err);
            }
          }

          // Update existing images (isMain status might have changed)
          for (const image of images.filter(
            (img) => !img.id.startsWith("temp-")
          )) {
            const existingImage = existingImages.find(
              (ei: any) => ei.id === image.id
            );
            if (existingImage && existingImage.isMain !== image.isMain) {
              try {
                await adminUpdateProductImage(productId, image.id, {
                  isMain: image.isMain,
                });
              } catch (err) {
                console.error("Failed to update image:", err);
              }
            }
          }
        }
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  const title = mode === "create" ? "Create Chili Oil Product" : "Edit Product";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-5xl my-8 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black tracking-tight mb-1">{title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {mode === "create"
                ? "Introduce a new heat profile or bottle size to your premium collection."
                : "Update product details and specifications."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
            disabled={saving}
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-8 max-h-[calc(100vh-250px)] overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-700 dark:text-red-200">
                    {error}
                  </p>
                </div>
              )}

              {/* Product Information Card */}
              <section className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    info
                  </span>
                  Product Information
                </h4>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Product Name
                    </span>
                    <input
                      className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg p-3 focus:ring-primary focus:border-primary"
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="e.g. Garlic Infused Sichuan Red Ember"
                      disabled={saving}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Description
                    </span>
                    <textarea
                      className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg p-3 min-h-[120px] focus:ring-primary focus:border-primary"
                      value={form.description}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, description: e.target.value }))
                      }
                      placeholder="Describe the aroma, crunch factor, and spice journey..."
                      disabled={saving}
                    />
                  </label>
                </div>
              </section>

              {/* Media Upload Card */}
              <section className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">
                      image
                    </span>
                    Media
                    <span className="text-xs font-normal text-slate-400">
                      ({images.length}/10)
                    </span>
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMediaGallery(true)}
                      disabled={saving || images.length >= 10}
                      className="px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">
                        photo_library
                      </span>
                      Add from Gallery
                    </button>
                    {selectedImages.size > 0 && (
                      <>
                        {selectedImages.size === 1 &&
                          !images.find((img) => selectedImages.has(img.id))
                            ?.isMain && (
                            <button
                              type="button"
                              onClick={() =>
                                setMainImage(Array.from(selectedImages)[0])
                              }
                              className="px-3 py-1.5 text-xs font-bold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                              disabled={saving}
                            >
                              Set as Main
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={deleteSelectedImages}
                          className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          disabled={saving}
                        >
                          Delete ({selectedImages.size})
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Image Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImages.has(image.id)
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-slate-200 dark:border-slate-700"
                      } ${
                        image.isMain ? "ring-2 ring-blue-500 ring-offset-2" : ""
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.alt || "Product"}
                        className="w-full h-32 object-cover"
                      />
                      {image.isMain && (
                        <div className="absolute top-1 left-1 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                          MAIN
                        </div>
                      )}
                      <div
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                        onClick={() => toggleImageSelection(image.id)}
                      >
                        <div
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                            selectedImages.has(image.id)
                              ? "bg-primary border-primary"
                              : "bg-white/20 border-white"
                          }`}
                        >
                          {selectedImages.has(image.id) && (
                            <span className="material-symbols-outlined text-sm text-white">
                              check
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {images.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-3 block">
                      photo_library
                    </span>
                    <p className="text-sm font-medium mb-1">
                      No images added yet
                    </p>
                    <p className="text-xs">
                      Click "Add from Gallery" to browse and upload images
                    </p>
                  </div>
                )}
              </section>

              {/* Variants Section */}
              <section className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">
                      layers
                    </span>
                    Variant Types
                  </h4>
                </div>

                <div className="space-y-4">
                  {/* Existing Variant Types */}
                  {variantTypes.map((variantType) => (
                    <div
                      key={variantType.id}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {editingVariantType === variantType.id ? (
                            <input
                              type="text"
                              className="font-bold text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded px-2 py-1"
                              value={variantType.name}
                              onChange={(e) =>
                                updateVariantTypeName(
                                  variantType.id,
                                  e.target.value
                                )
                              }
                              onBlur={() => setEditingVariantType(null)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && setEditingVariantType(null)
                              }
                              autoFocus
                              disabled={saving}
                            />
                          ) : (
                            <h5
                              className="font-bold text-sm cursor-pointer hover:text-primary"
                              onClick={() =>
                                setEditingVariantType(variantType.id)
                              }
                            >
                              {variantType.name}
                            </h5>
                          )}
                          <span className="text-xs text-slate-400">
                            ({variantType.options.length} options)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVariantType(variantType.id)}
                          disabled={saving}
                          className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-sm">
                            close
                          </span>
                        </button>
                      </div>

                      {/* Options List */}
                      <div className="space-y-2">
                        {variantType.options.map((option) => (
                          <div
                            key={option.id}
                            className="flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-slate-400 text-sm">
                              fiber_manual_record
                            </span>
                            <input
                              type="text"
                              className="flex-1 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded px-3 py-1.5 text-sm"
                              value={option.value}
                              onChange={(e) =>
                                updateVariantOption(
                                  variantType.id,
                                  option.id,
                                  e.target.value
                                )
                              }
                              placeholder="Option value (e.g., 50ml, Medium)"
                              disabled={saving}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                removeVariantOption(variantType.id, option.id)
                              }
                              disabled={saving}
                              className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-60"
                            >
                              <span className="material-symbols-outlined text-sm">
                                delete
                              </span>
                            </button>
                          </div>
                        ))}

                        {/* Add Option Button */}
                        <button
                          type="button"
                          onClick={() => addVariantOption(variantType.id)}
                          disabled={saving}
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-60 mt-2"
                        >
                          <span className="material-symbols-outlined text-sm">
                            add
                          </span>
                          Add {variantType.name} Option
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add New Variant Type */}
                  <div className="bg-white dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm"
                        value={newVariantTypeName}
                        onChange={(e) => setNewVariantTypeName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addVariantType()}
                        placeholder="New variant type name (e.g., Heat Level, Flavor)"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        onClick={addVariantType}
                        disabled={saving || !newVariantTypeName.trim()}
                        className="flex items-center gap-1 text-sm font-bold bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-sm">
                          add
                        </span>
                        Add Type
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm mt-0.5">
                      info
                    </span>
                    <span>
                      Define variant types (like Size, Heat Level) and their
                      options. Products with variants will be created as
                      separate SKUs, each with their own pricing and inventory.
                    </span>
                  </p>
                </div>
              </section>

              {/* Product Variants (SKUs) Section */}
              {variantTypes.some((vt) => vt.options.length > 0) && (
                <section className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">
                        inventory_2
                      </span>
                      Product Variants (SKUs)
                    </h4>
                    <button
                      type="button"
                      onClick={generateVariantCombinations}
                      disabled={saving}
                      className="flex items-center gap-1 text-sm font-bold bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-sm">
                        refresh
                      </span>
                      Generate Variants
                    </button>
                  </div>

                  {productVariants.length === 0 ? (
                    <div className="bg-white dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center">
                      <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">
                        inventory_2
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                        No product variants generated yet
                      </p>
                      <button
                        type="button"
                        onClick={generateVariantCombinations}
                        disabled={saving}
                        className="text-sm font-bold text-primary hover:underline disabled:opacity-60"
                      >
                        Click "Generate Variants" to create SKUs from your
                        variant types
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400">
                              Variant
                            </th>
                            <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400">
                              SKU
                            </th>
                            <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400">
                              Price ($)
                            </th>
                            <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400">
                              Stock
                            </th>
                            <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {productVariants.map((variant) => {
                            const variantLabel = Object.entries(
                              variant.combination
                            )
                              .map(([, value]) => value)
                              .join(" / ");

                            return (
                              <tr key={variant.id}>
                                <td className="px-4 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold">
                                      {variantLabel}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {Object.entries(variant.combination)
                                        .map(([typeId, value]) => {
                                          const vt = variantTypes.find(
                                            (t) => t.id === typeId
                                          );
                                          return `${vt?.name}: ${value}`;
                                        })
                                        .join(", ")}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <input
                                    type="text"
                                    className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 p-1 focus:ring-0 focus:border-primary text-slate-700 dark:text-slate-300"
                                    value={variant.sku}
                                    onChange={(e) =>
                                      updateProductVariant(
                                        variant.id,
                                        "sku",
                                        e.target.value
                                      )
                                    }
                                    placeholder={`SKU-${variantLabel
                                      .replace(/\s/g, "-")
                                      .toUpperCase()}`}
                                    disabled={saving}
                                  />
                                </td>
                                <td className="px-4 py-4">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-24 bg-transparent border-b border-slate-200 dark:border-slate-700 p-1 focus:ring-0 focus:border-primary font-medium"
                                    value={variant.price}
                                    onChange={(e) =>
                                      updateProductVariant(
                                        variant.id,
                                        "price",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    disabled={saving}
                                  />
                                </td>
                                <td className="px-4 py-4">
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-20 bg-transparent border-b border-slate-200 dark:border-slate-700 p-1 focus:ring-0 focus:border-primary font-medium"
                                    value={variant.stock}
                                    onChange={(e) =>
                                      updateProductVariant(
                                        variant.id,
                                        "stock",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    disabled={saving}
                                  />
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeProductVariant(variant.id)
                                    }
                                    disabled={saving}
                                    className="material-symbols-outlined text-slate-400 hover:text-red-500 text-sm transition-colors disabled:opacity-60"
                                  >
                                    delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg">
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm mt-0.5">
                        warning
                      </span>
                      <span>
                        <strong>
                          Each variant is a unique SKU with independent
                          inventory and pricing.
                        </strong>{" "}
                        Click "Generate Variants" to create all combinations
                        from your variant types above. You can then customize
                        the SKU, price, and stock for each variant.
                      </span>
                    </p>
                  </div>
                </section>
              )}

              {/* Technical Details (collapsed by default) */}
              <details className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <summary className="text-lg font-bold cursor-pointer flex items-center gap-2 select-none">
                  <span className="material-symbols-outlined text-primary">
                    tune
                  </span>
                  Advanced Details
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                        Product ID
                      </span>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg text-sm p-2"
                        value={form.id}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, id: e.target.value }))
                        }
                        placeholder="auto-generated"
                        disabled={saving || mode !== "create"}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                        SKU{" "}
                        {variantTypes.some((vt) => vt.options.length > 0) && (
                          <span className="text-orange-500">(Base Only)</span>
                        )}
                      </span>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg text-sm p-2"
                        value={form.sku}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, sku: e.target.value }))
                        }
                        placeholder={
                          variantTypes.some((vt) => vt.options.length > 0)
                            ? "Base SKU prefix (e.g. RE-ORIG)"
                            : "e.g. RE-OR-50"
                        }
                        disabled={saving}
                      />
                      {variantTypes.some((vt) => vt.options.length > 0) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Individual variant SKUs are set in Product Variants
                          section
                        </p>
                      )}
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                        Price ($)
                      </span>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg text-sm p-2"
                        type="number"
                        min="0"
                        step="0.01"
                        value={Number(form.priceCents) / 100}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            priceCents: Math.round(
                              Number(e.target.value) * 100
                            ),
                          }))
                        }
                        disabled={saving}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                        Stock
                      </span>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg text-sm p-2"
                        type="number"
                        min="0"
                        value={form.stock}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, stock: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                        Size/Variant
                      </span>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg text-sm p-2"
                        value={form.variantName}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            variantName: e.target.value,
                          }))
                        }
                        placeholder="50ml"
                        disabled={saving}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <input
                      id="requiresShipping"
                      type="checkbox"
                      checked={!!form.requiresShipping}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          requiresShipping: e.target.checked,
                        }))
                      }
                      disabled={saving}
                      className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700"
                    />
                    <label
                      htmlFor="requiresShipping"
                      className="text-sm font-medium"
                    >
                      Requires Shipping
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Weight (oz)
                      </label>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.weightOz}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, weightOz: e.target.value }))
                        }
                        disabled={saving}
                        placeholder="2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Weight (g)
                      </label>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm"
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.weightG}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, weightG: e.target.value }))
                        }
                        disabled={saving}
                        placeholder="70.8"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Volume (ml)
                      </label>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm"
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.volumeMl}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, volumeMl: e.target.value }))
                        }
                        disabled={saving}
                        placeholder="50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Weight (g)
                      </label>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm"
                        type="number"
                        min="0"
                        value={form.weightGrams}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            weightGrams: e.target.value,
                          }))
                        }
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Length (mm)
                      </label>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm"
                        type="number"
                        min="0"
                        value={form.lengthMm}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, lengthMm: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Width (mm)
                      </label>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm"
                        type="number"
                        min="0"
                        value={form.widthMm}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, widthMm: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Height (mm)
                      </label>
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm"
                        type="number"
                        min="0"
                        value={form.heightMm}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, heightMm: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* Right Column: Sidebar */}
            <div className="space-y-6">
              {/* Status & Organization */}
              <section className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    settings
                  </span>
                  Organization
                </h4>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                      Category
                    </span>
                    <select
                      className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:ring-primary focus:border-primary p-2"
                      value={form.categoryId}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, categoryId: e.target.value }))
                      }
                      disabled={saving}
                    >
                      <option value="">No category</option>
                      {categories.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {newCategoryName.trim() === "" && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setNewCategoryName(" ")}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        + Create New Category
                      </button>
                    </div>
                  )}
                  {newCategoryName.trim() !== "" && (
                    <div className="space-y-2">
                      <input
                        className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm"
                        placeholder="Category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        disabled={saving}
                      />
                      <button
                        type="button"
                        onClick={() => setNewCategoryName("")}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <label className="block">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase">
                      Status
                    </span>
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${
                        form.active
                          ? "bg-green-500/10 text-green-600"
                          : "bg-slate-500/10 text-slate-600"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          form.active ? "bg-green-500" : "bg-slate-500"
                        }`}
                      ></span>
                      {form.active ? "Active" : "Inactive"}
                    </div>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.active}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, active: e.target.checked }))
                        }
                        disabled={saving}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium">
                        {form.active ? "Visible in shop" : "Hidden from shop"}
                      </span>
                    </label>
                  </label>
                </div>
              </section>

              {/* Preview Card */}
              <div className="relative group overflow-hidden rounded-xl aspect-[3/4] border border-slate-200 dark:border-slate-800">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10"></div>
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-6xl text-slate-400">
                      image
                    </span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 p-4 z-20 text-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                    Preview
                  </p>
                  <p className="font-bold text-lg leading-tight">
                    {form.name || "Your product listing will appear here"}
                  </p>
                </div>
                <div className="absolute top-4 right-4 z-20">
                  <div className="bg-white/10 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider">
                    {mode === "create" ? "Draft" : "Edit"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-60"
            onClick={onClose}
            disabled={saving}
          >
            Discard
          </button>
          <button
            type="button"
            className="bg-primary text-white px-6 py-2.5 rounded-lg font-bold text-sm tracking-wide hover:bg-red-700 transition-colors shadow-lg shadow-primary/20 disabled:opacity-60"
            onClick={onSubmit}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : mode === "create"
              ? productVariants.length > 0
                ? `Publish ${productVariants.length} Variant${
                    productVariants.length !== 1 ? "s" : ""
                  }`
                : "Publish Product"
              : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Media Gallery Modal */}
      {showMediaGallery && (
        <MediaGallery
          onClose={() => setShowMediaGallery(false)}
          onSelect={handleMediaGallerySelect}
          multiSelect={true}
        />
      )}
    </div>
  );
}

interface ModalState {
  mode: "create" | "edit";
  product?: Product;
}

interface InventoryStats {
  totalSkus: number;
  inStockUnits: number;
  low: number;
  out: number;
}

export default function AdminInventory() {
  const { isAuthed } = useAdminAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [groups, setGroups] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [query, setQuery] = useState<string>("");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("newest");

  const [modal, setModal] = useState<ModalState | null>(null);

  async function load(): Promise<void> {
    if (!isAuthed) return;
    setError("");
    setLoading(true);
    try {
      const [g, p] = await Promise.all([adminCategories(), adminProducts()]);
      setGroups(Array.isArray(g) ? g : []);
      setProducts(Array.isArray(p) ? p : []);
    } catch (e: any) {
      setError(e.message);
      setGroups([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) {
      setGroups([]);
      setProducts([]);
      setError("");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  const sizeOptions = useMemo<string[]>(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.variantName) set.add(p.variantName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const categoryById = useMemo<Map<string, ProductCategory>>(() => {
    const map = new Map<string, ProductCategory>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const filtered = useMemo<Product[]>(() => {
    const q = query.trim().toLowerCase();
    let list = [...products];

    if (q) {
      list = list.filter((p) => {
        return (
          String(p.name || "")
            .toLowerCase()
            .includes(q) ||
          String(p.sku || "")
            .toLowerCase()
            .includes(q) ||
          String(p.id || "")
            .toLowerCase()
            .includes(q)
        );
      });
    }

    if (sizeFilter !== "all") {
      list = list.filter((p) => (p.variantName || "") === sizeFilter);
    }

    if (sort === "stockLow") {
      list.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    } else if (sort === "stockHigh") {
      list.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    } else if (sort === "priceHigh") {
      list.sort((a, b) => (b.priceCents || 0) - (a.priceCents || 0));
    } else {
      // newest (approx): createdAt is not included; fall back to id sort.
      list.sort((a, b) => String(b.id).localeCompare(String(a.id)));
    }

    return list;
  }, [products, query, sizeFilter, sort]);

  const stats = useMemo<InventoryStats>(() => {
    const totalSkus = products.length;
    const inStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const low = products.filter(
      (p) => p.active && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD
    ).length;
    const out = products.filter((p) => p.active && p.stock === 0).length;
    return { totalSkus, inStockUnits, low, out };
  }, [products]);

  async function onDelete(p: Product): Promise<void> {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete ${p.sku} (${p.name})?`)) return;
    setError("");
    setLoading(true);
    try {
      await adminDeleteProduct(p.id);
      await load();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  function exportCsv(): void {
    if (!isAuthed) return;
    const rows: (string | number | boolean)[][] = [
      [
        "id",
        "sku",
        "name",
        "variantName",
        "category",
        "stock",
        "priceCents",
        "currency",
        "active",
        "imageUrl",
        "requiresShipping",
        "weightGrams",
        "lengthMm",
        "widthMm",
        "heightMm",
      ],
      ...filtered.map((p) => [
        p.id,
        p.sku,
        p.name,
        p.variantName || "",
        categoryById.get(p.categoryId!)?.name || "",
        p.stock,
        p.priceCents,
        p.currency,
        p.active,
        p.imageUrl || "",
        p.requiresShipping,
        p.weightGrams || "",
        p.lengthMm || "",
        p.widthMm || "",
        p.heightMm || "",
      ]),
    ];
    downloadCsv("redember-inventory.csv", rows);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white font-display">
            Inventory Management
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Stock levels, variants (SKUs), pricing, and shipping metadata.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors disabled:opacity-60"
            onClick={exportCsv}
            disabled={!isAuthed || loading}
          >
            <span className="material-symbols-outlined text-xl mr-2">
              download
            </span>
            Export
          </button>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 shadow-md transition-all active:scale-95 disabled:opacity-60"
            onClick={() => setModal({ mode: "create" })}
            disabled={!isAuthed || loading}
          >
            <span className="material-symbols-outlined text-xl mr-2">add</span>
            Add New Product
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Total SKUs
          </p>
          <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white leading-none">
            {stats.totalSkus}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            In Stock
          </p>
          <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white leading-none">
            {stats.inStockUnits}{" "}
            <span className="text-xs font-normal text-slate-400 ml-1">
              units
            </span>
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-orange-500">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Low Stock Alerts
          </p>
          <h3 className="text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400 leading-none">
            {stats.low}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Out of Stock
          </p>
          <h3 className="text-2xl font-bold mt-1 text-slate-400 dark:text-slate-600 leading-none">
            {stats.out}
          </h3>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary dark:text-white transition-all"
              placeholder="Search by product name, ID, or SKU..."
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!isAuthed}
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary dark:text-slate-300"
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              disabled={!isAuthed}
            >
              <option value="all">All Sizes</option>
              {sizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary dark:text-slate-300"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              disabled={!isAuthed}
            >
              <option value="newest">Sort By: Newest</option>
              <option value="stockLow">Stock: Low to High</option>
              <option value="stockHigh">Stock: High to Low</option>
              <option value="priceHigh">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  SKU
                </th>
                <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  Product Name
                </th>
                <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  Size
                </th>
                <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  Stock Quantity
                </th>
                <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  Price
                </th>
                <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  Status
                </th>
                <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!isAuthed ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-sm text-slate-500 dark:text-slate-400"
                  >
                    Enter your admin token to manage inventory.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-sm text-slate-500 dark:text-slate-400"
                  >
                    {loading ? "LoadingΓÇª" : "No variants match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const status = statusForStock(p.stock, p.active);
                  const statusClass =
                    status.kind === "in"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : status.kind === "low"
                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                      : status.kind === "out"
                      ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">
                        {p.sku}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            {p.imageUrl ? (
                              <img
                                alt={p.name}
                                src={p.imageUrl}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                                IMG
                              </div>
                            )}
                          </div>
                          <div>
                            <div>{p.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {categoryById.get(p.categoryId!)?.name || p.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {p.variantName || "ΓÇö"}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-semibold ${
                          status.kind === "low"
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {p.stock}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {formatMoney(p.priceCents, p.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-primary transition-colors"
                          onClick={() => setModal({ mode: "edit", product: p })}
                          disabled={loading}
                          aria-label="Edit"
                        >
                          <span className="material-symbols-outlined text-lg">
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          onClick={() => onDelete(p)}
                          disabled={loading}
                          aria-label="Delete"
                        >
                          <span className="material-symbols-outlined text-lg">
                            delete
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing 1 to {Math.min(filtered.length, 50)} of {filtered.length}{" "}
            variants
          </p>
          <div className="flex items-center gap-2">
            <button
              className="p-2 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-50"
              type="button"
              disabled
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              className="px-3 py-1 border border-primary bg-primary/5 text-primary text-sm font-medium rounded-md"
              type="button"
              disabled
            >
              1
            </button>
            <button
              className="p-2 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500"
              type="button"
              disabled
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
          "Where heat meets flavor" ΓÇó Admin Panel
        </p>
      </div>
      {modal && (
        <ProductModal
          mode={modal.mode}
          initial={modal.product || null}
          categories={groups}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
