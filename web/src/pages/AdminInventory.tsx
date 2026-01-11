import React, { useEffect, useMemo, useState } from "react";
import {
  adminCreateGroup,
  adminCreateProduct,
  adminDeleteProduct,
  adminGroups,
  adminProducts,
  adminUpdateProduct,
  adminUploadImage,
} from "../lib/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Product, ProductGroup } from "../types";

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
  sku: string;
  groupId: string;
  variantName: string;
  priceCents: number | string;
  currency: string;
  stock: number | string;
  active: boolean;
  imageUrl: string;
  description: string;
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
  groups: ProductGroup[];
  initial: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

function ProductModal({
  mode,
  groups,
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
      sku: p.sku || "",
      groupId: p.groupId || "",
      variantName: p.variantName || "",
      priceCents:
        typeof p.priceCents === "number" && Number.isInteger(p.priceCents)
          ? p.priceCents
          : 0,
      currency: p.currency || "usd",
      stock:
        typeof p.stock === "number" && Number.isInteger(p.stock) ? p.stock : 0,
      active: typeof p.active === "boolean" ? p.active : true,
      imageUrl: p.imageUrl || "",
      description: p.description || "",
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

  const [newGroupName, setNewGroupName] = useState<string>("");

  async function onUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      setSaving(true);
      const { url } = await adminUploadImage(file);
      setForm((prev) => ({ ...prev, imageUrl: url }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  }

  async function createGroupIfNeeded(): Promise<ProductGroup | null> {
    const name = newGroupName.trim();
    if (!name) return null;
    const handle = makeIdFromName(name);
    if (!handle) throw new Error("Group handle could not be generated");
    const group = await adminCreateGroup({ name, handle });
    setNewGroupName("");
    return group;
  }

  async function onSubmit(): Promise<void> {
    setError("");
    setSaving(true);
    try {
      const createdGroup = await createGroupIfNeeded();
      const payload = {
        id: form.id.trim(),
        name: form.name.trim(),
        sku: form.sku.trim(),
        groupId: createdGroup?.id || (form.groupId ? form.groupId : null),
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
        weightG: form.weightG === "" ? null : parseFloat(String(form.weightG)),
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

      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  const title = mode === "create" ? "Add New Product" : "Edit Variant";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl my-4 sm:my-8 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-bold font-display truncate">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Variants are separate SKUs (stock + price tracked per SKU).
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

        <div className="p-4 sm:p-6 max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-150px)] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {error && (
              <div className="sm:col-span-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
                <p className="text-xs sm:text-sm text-red-700 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Product Name
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Original Red Ember Chili Oil"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Product ID
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                value={form.id}
                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                placeholder="e.g. red-ember-spice-50ml"
                disabled={saving || mode !== "create"}
              />
              {mode === "create" && (
                <p className="mt-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                  Leave blank to auto-generate from name.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                SKU
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                value={form.sku}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sku: e.target.value }))
                }
                placeholder="e.g. RE-OR-50"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Variant / Size
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                value={form.variantName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, variantName: e.target.value }))
                }
                placeholder="50ml"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Group
              </label>
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                value={form.groupId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, groupId: e.target.value }))
                }
                disabled={saving}
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                  placeholder="Or create group (name)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Price (cents)
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                type="number"
                min="0"
                value={form.priceCents}
                onChange={(e) =>
                  setForm((p) => ({ ...p, priceCents: e.target.value }))
                }
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Currency
              </label>
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                value={form.currency}
                onChange={(e) =>
                  setForm((p) => ({ ...p, currency: e.target.value }))
                }
                disabled={saving}
              >
                <option value="usd">USD</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Stock
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) =>
                  setForm((p) => ({ ...p, stock: e.target.value }))
                }
                disabled={saving}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="active"
                type="checkbox"
                checked={!!form.active}
                onChange={(e) =>
                  setForm((p) => ({ ...p, active: e.target.checked }))
                }
                disabled={saving}
                className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700"
              />
              <label htmlFor="active" className="text-sm">
                Active (visible in shop)
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Image
              </label>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-lg sm:rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {form.imageUrl ? (
                    <img
                      alt="Preview"
                      src={form.imageUrl}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center p-2">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, imageUrl: e.target.value }))
                    }
                    placeholder="/images/product.svg"
                    disabled={saving}
                  />
                  <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onUpload}
                      disabled={saving}
                      className="text-xs sm:text-sm"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Max 5MB
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                disabled={saving}
                placeholder="Product description..."
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center gap-3 mb-3">
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
                <label htmlFor="requiresShipping">Requires Shipping</label>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                <div>
                  <label className="block text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Weight (oz)
                  </label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-sm"
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
                  <label className="block text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Weight (g)
                  </label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-sm"
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
                  <label className="block text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Volume (ml)
                  </label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-sm"
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                  ["weightGrams", "Weight (g)"],
                  ["lengthMm", "Length (mm)"],
                  ["widthMm", "Width (mm)"],
                  ["heightMm", "Height (mm)"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {label}
                    </label>
                    <input
                      className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-sm"
                      type="number"
                      min="0"
                      value={
                        form[key as keyof ProductFormData] as
                          | string
                          | number
                          | undefined
                      }
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [key]: e.target.value }))
                      }
                      disabled={saving}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors disabled:opacity-60"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 sm:py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 shadow-md transition-all active:scale-95 disabled:opacity-60"
            onClick={onSubmit}
            disabled={saving}
          >
            <span className="material-symbols-outlined text-xl mr-2">save</span>
            Save
          </button>
        </div>
      </div>
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

  const [groups, setGroups] = useState<ProductGroup[]>([]);
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
      const [g, p] = await Promise.all([adminGroups(), adminProducts()]);
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

  const groupById = useMemo<Map<string, ProductGroup>>(() => {
    const map = new Map<string, ProductGroup>();
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
        "group",
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
        groupById.get(p.groupId!)?.name || "",
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
                    {loading ? "Loading…" : "No variants match your filters."}
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
                              {groupById.get(p.groupId!)?.name || p.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {p.variantName || "—"}
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
          "Where heat meets flavor" • Admin Panel
        </p>
      </div>
      {modal && (
        <ProductModal
          mode={modal.mode}
          initial={modal.product || null}
          groups={groups}
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
