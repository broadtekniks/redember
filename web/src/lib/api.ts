async function readJsonOrText(res: Response): Promise<any> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
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

export async function adminGroups(): Promise<any> {
  const res = await api("/api/admin/groups");
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(json?.error || json?.message || "Admin groups failed");
  return json;
}

export async function adminCreateGroup(payload: any): Promise<any> {
  const res = await api("/api/admin/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin create group failed"
    );
  return json;
}

export async function adminUpdateGroup(id: string, payload: any): Promise<any> {
  const res = await api(`/api/admin/groups/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin update group failed"
    );
  return json;
}

export async function adminDeleteGroup(id: string): Promise<any> {
  const res = await api(`/api/admin/groups/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const json = await readJsonOrText(res);
  if (!res.ok)
    throw new Error(
      json?.error || json?.message || "Admin delete group failed"
    );
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

export async function adminUploadImage(file: File): Promise<any> {
  const form = new FormData();
  form.append("file", file);

  const res = await api("/api/admin/upload", {
    method: "POST",
    headers: {}, // Clear Content-Type to let browser set it with boundary
    body: form,
  });
  const json = await readJsonOrText(res);
  if (!res.ok) throw new Error(json?.error || json?.message || "Upload failed");
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
