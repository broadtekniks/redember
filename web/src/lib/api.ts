export async function readJsonOrText(res: Response): Promise<any> {
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return { _nonJson: true, text };
    }
  }
  return { _nonJson: true, text };
}

// Generic API helper with credentials support
export async function api(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const defaultOptions: RequestInit = {
    credentials: "include", // Include cookies in requests
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  const res = await fetch(endpoint, { ...defaultOptions, ...options });
  return res;
}

export async function getProduct(): Promise<any> {
  const res = await api("/api/product");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to load product");
  return json;
}

export async function getProducts(): Promise<any> {
  const res = await api("/api/products");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to load products");
  return json;
}

export async function getProductById(id: string): Promise<any> {
  const res = await api(`/api/products/${encodeURIComponent(id)}`);
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to load product");
  return json;
}

export async function getCategoryImages(categoryId: string): Promise<any> {
  const res = await api(
    `/api/categories/${encodeURIComponent(categoryId)}/images`
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to load images");
  return json;
}

export async function createCheckout(
  productId: string,
  quantity: number
): Promise<any> {
  const res = await api("/api/checkout", {
    method: "POST",
    body: JSON.stringify({ productId, quantity }),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Checkout failed");
  return json;
}

export async function createCartCheckout(
  items: Array<{ productId: string; quantity: number }>
): Promise<any> {
  const res = await api("/api/checkout/cart", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Checkout failed");
  return json;
}

export async function calculateShipping(
  items: Array<{ productId: string; quantity: number }>,
  country?: string
): Promise<any> {
  const res = await api("/api/shipping/calculate", {
    method: "POST",
    body: JSON.stringify({ items, country }),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Shipping calculation failed"
    );
  return json;
}

// Admin API functions (now use JWT auth via httpOnly cookies)
export async function adminInventory(): Promise<any> {
  const res = await api("/api/admin/inventory");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin inventory failed");
  return json;
}

export async function adminOrders(): Promise<any> {
  const res = await api("/api/admin/orders");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin orders failed");
  return json;
}

export async function adminCreateManualOrder(payload: any): Promise<any> {
  const res = await api("/api/admin/orders/manual", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to create manual order"
    );
  return json;
}

export async function adminCustomers(): Promise<any> {
  const res = await api("/api/admin/customers");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin customers failed");
  return json;
}

export async function adminCategories(): Promise<any> {
  const res = await api("/api/admin/categories");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin categories failed");
  return json;
}

export async function adminCreateCategory(payload: any): Promise<any> {
  const res = await api("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin create category failed"
    );
  return json;
}

export async function adminUpdateCategory(
  id: string,
  payload: any
): Promise<any> {
  const res = await api(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin update category failed"
    );
  return json;
}

export async function adminDeleteCategory(id: string): Promise<any> {
  const res = await api(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin delete category failed"
    );
  return json;
}

export async function adminGetCategoryImages(categoryId: string): Promise<any> {
  const res = await api(
    `/api/admin/categories/${encodeURIComponent(categoryId)}/images`
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to load images");
  return json;
}

export async function adminAddCategoryImage(
  categoryId: string,
  payload: { url: string; alt?: string }
): Promise<any> {
  const res = await api(
    `/api/admin/categories/${encodeURIComponent(categoryId)}/images`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to add image");
  return json;
}

export async function adminUpdateCategoryImage(
  categoryId: string,
  imageId: string,
  payload: { alt?: string; sortOrder?: number }
): Promise<any> {
  const res = await api(
    `/api/admin/categories/${encodeURIComponent(
      categoryId
    )}/images/${encodeURIComponent(imageId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to update image");
  return json;
}

export async function adminDeleteCategoryImage(
  categoryId: string,
  imageId: string
): Promise<any> {
  const res = await api(
    `/api/admin/categories/${encodeURIComponent(
      categoryId
    )}/images/${encodeURIComponent(imageId)}`,
    {
      method: "DELETE",
    }
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to delete image");
  return json;
}

export async function adminReorderCategoryImages(
  categoryId: string,
  updates: Array<{ id: string; sortOrder: number }>
): Promise<any> {
  const res = await api(
    `/api/admin/categories/${encodeURIComponent(categoryId)}/images/reorder`,
    {
      method: "POST",
      body: JSON.stringify({ updates }),
    }
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to reorder images");
  return json;
}

export async function adminProducts(): Promise<any> {
  const res = await api("/api/admin/products");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin products failed");
  return json;
}

export async function adminCreateProduct(payload: any): Promise<any> {
  const res = await api("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin create product failed"
    );
  return json;
}

export async function adminUpdateProduct(
  id: string,
  payload: any
): Promise<any> {
  const res = await api(`/api/admin/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin update product failed"
    );
  return json;
}

export async function adminDeleteProduct(id: string): Promise<any> {
  const res = await api(`/api/admin/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin delete product failed"
    );
  return json;
}

export async function adminUsers(): Promise<any> {
  const res = await api("/api/admin/users");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin users failed");
  return json;
}

export async function adminCreateUser(payload: any): Promise<any> {
  const res = await api("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin create user failed");
  return json;
}

export async function adminUpdateUser(id: string, payload: any): Promise<any> {
  const res = await api(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin update user failed");
  return json;
}

export async function adminDeleteUser(id: string): Promise<any> {
  const res = await api(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin delete user failed");
  return json;
}

export async function adminChangePassword(
  id: string,
  password: string
): Promise<any> {
  const res = await api(`/api/admin/users/${encodeURIComponent(id)}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin change password failed"
    );
  return json;
}

export async function adminUploadImage(
  file: File,
  folder?: string
): Promise<any> {
  const form = new FormData();
  form.append("file", file);

  const queryString = folder ? `?folder=${encodeURIComponent(folder)}` : "";
  const res = await api(`/api/admin/upload${queryString}`, {
    method: "POST",
    headers: {}, // Clear Content-Type to let browser set it with boundary
    body: form,
  });
  const json = await readJsonOrText(res);
  if (!res.ok) throw new Error(json?.error || json?.message || "Upload failed");
  return json;
}

// Product Image Management
export async function adminGetProductImages(productId: string): Promise<any> {
  const res = await api(
    `/api/admin/products/${encodeURIComponent(productId)}/images`
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to get product images"
    );
  return json;
}

export async function adminAddProductImage(
  productId: string,
  payload: { mediaId: string; isMain?: boolean }
): Promise<any> {
  const res = await api(
    `/api/admin/products/${encodeURIComponent(productId)}/images`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to add product image"
    );
  return json;
}

export async function adminUpdateProductImage(
  productId: string,
  imageId: string,
  payload: { url?: string; alt?: string; isMain?: boolean; sortOrder?: number }
): Promise<any> {
  const res = await api(
    `/api/admin/products/${encodeURIComponent(
      productId
    )}/images/${encodeURIComponent(imageId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to update product image"
    );
  return json;
}

export async function adminDeleteProductImage(
  productId: string,
  imageId: string
): Promise<any> {
  const res = await api(
    `/api/admin/products/${encodeURIComponent(
      productId
    )}/images/${encodeURIComponent(imageId)}`,
    { method: "DELETE" }
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to delete product image"
    );
  return json;
}

export async function adminReorderProductImages(
  productId: string,
  imageIds: string[]
): Promise<any> {
  const res = await api(
    `/api/admin/products/${encodeURIComponent(productId)}/images/reorder`,
    {
      method: "POST",
      body: JSON.stringify({ imageIds }),
    }
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to reorder product images"
    );
  return json;
}

// Media Library
export async function adminGetMediaLibrary(): Promise<any> {
  const res = await api("/api/admin/media");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to get media library"
    );
  return json;
}

export async function adminAddMediaLibraryImage(
  payload: { url: string; filename?: string; size?: number; mimeType?: string; alt?: string }
): Promise<any> {
  const res = await api("/api/admin/media", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to add media library image"
    );
  return json;
}

export async function adminGetShipping(): Promise<any> {
  const res = await api("/api/admin/shipping");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to get shipping config"
    );
  return json;
}

export async function adminUpdateShippingZone(
  id: string,
  payload: any
): Promise<any> {
  const res = await api(`/api/admin/shipping/zones/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to update shipping zone"
    );
  return json;
}

export async function adminCreateShippingZone(payload: any): Promise<any> {
  const res = await api("/api/admin/shipping/zones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to create shipping zone"
    );
  return json;
}

export async function getSettings(): Promise<any> {
  const res = await api("/api/settings");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to load settings");
  return json;
}

export async function adminGetSettings(): Promise<any> {
  const res = await api("/api/admin/settings");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to load settings");
  return json;
}

export async function adminUpdateSettings(payload: any): Promise<any> {
  const res = await api("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to save settings");
  return json;
}

// Media Gallery
export async function adminGetMedia(folder?: string): Promise<any> {
  const queryString = folder ? `?folder=${encodeURIComponent(folder)}` : "";
  const res = await api(`/api/admin/media${queryString}`);
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to get media");
  return json;
}

export async function adminDeleteMedia(key: string): Promise<any> {
  const res = await api(`/api/admin/media/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Failed to delete media");
  return json;
}

// Variant Type APIs
export async function adminGetVariantTypes(categoryId?: string): Promise<any> {
  const endpoint = categoryId
    ? `/api/admin/categories/${encodeURIComponent(categoryId)}/variant-types`
    : `/api/admin/variant-types`;
  const res = await api(endpoint);
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to get variant types"
    );
  return json;
}

export async function adminCreateVariantType(
  categoryId: string | undefined,
  payload: { name: string; displayOrder?: number }
): Promise<any> {
  const endpoint = categoryId
    ? `/api/admin/categories/${encodeURIComponent(categoryId)}/variant-types`
    : `/api/admin/variant-types`;
  const res = await api(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to create variant type"
    );
  return json;
}

export async function adminDeleteVariantType(
  categoryId: string | undefined,
  typeId: string
): Promise<any> {
  const endpoint = categoryId
    ? `/api/admin/categories/${encodeURIComponent(
        categoryId
      )}/variant-types/${encodeURIComponent(typeId)}`
    : `/api/admin/variant-types/${encodeURIComponent(typeId)}`;
  const res = await api(endpoint, { method: "DELETE" });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to delete variant type"
    );
  return json;
}

// Variant Value APIs
export async function adminSetVariantValues(
  productId: string,
  values: Array<{ variantTypeId: string; value: string }>
): Promise<any> {
  const res = await api(
    `/api/admin/products/${encodeURIComponent(productId)}/variant-values`,
    {
      method: "PUT",
      body: JSON.stringify({ values }),
    }
  );
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Failed to set variant values"
    );
  return json;
}
