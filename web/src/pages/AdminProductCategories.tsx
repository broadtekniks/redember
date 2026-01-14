import { useEffect, useState } from "react";
import {
  adminCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
} from "../lib/api";
import { ProductCategory } from "../types";
import ConfirmModal from "../components/ConfirmModal";

export default function AdminProductCategories() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<ProductCategory | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] =
    useState<ProductCategory | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    handle: "",
    description: "",
    active: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const data = await adminCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCreate(): void {
    setEditingCategory(null);
    setFormData({
      name: "",
      handle: "",
      description: "",
      active: true,
    });
    setShowModal(true);
  }

  function handleEdit(category: ProductCategory): void {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      handle: category.handle,
      description: category.description || "",
      active: category.active,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError("");

    try {
      if (editingCategory) {
        await adminUpdateCategory(editingCategory.id, formData);
      } else {
        await adminCreateCategory(formData);
      }
      setShowModal(false);
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleDeleteClick(category: ProductCategory): void {
    setConfirmDeleteCategory(category);
  }

  async function handleConfirmDeleteCategory(): Promise<void> {
    if (!confirmDeleteCategory) return;

    setError("");
    try {
      await adminDeleteCategory(confirmDeleteCategory.id);
      setConfirmDeleteCategory(null);
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
      setConfirmDeleteCategory(null);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display mb-2">
            Product Categories
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Manage product categories to organize variants (e.g., different
            sizes of the same product)
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          New Category
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Handle
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {categories.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No product categories yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr
                    key={category.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {category.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-sm">
                      {category.handle}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm">
                      {category.description || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          category.active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {category.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(category)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">
                            edit
                          </span>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(category)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">
                            delete
                          </span>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingCategory
                  ? "Edit Product Category"
                  : "New Product Category"}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                  placeholder="Red Ember Spice"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Handle (URL slug) *
                </label>
                <input
                  type="text"
                  value={formData.handle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      handle: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm font-mono"
                  placeholder="red-ember-spice"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Used in URLs, lowercase letters, numbers, and hyphens only
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                  placeholder="Premium small-batch chili oil..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                  className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4"
                />
                <label
                  htmlFor="active"
                  className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Active
                </label>
              </div>
            </form>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium bg-primary hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                {editingCategory ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteCategory && (
        <ConfirmModal
          title="Delete Product Category"
          message={`Are you sure you want to delete "${confirmDeleteCategory.name}"? This action cannot be undone. All products in this category must be deleted first.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={handleConfirmDeleteCategory}
          onCancel={() => setConfirmDeleteCategory(null)}
        />
      )}
    </div>
  );
}
