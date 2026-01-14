import { useEffect, useState } from "react";
import {
  adminUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminChangePassword,
} from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  createdAt: string;
}

interface UserFormData {
  email: string;
  name: string;
  password: string;
  active: boolean;
}

interface UserModalProps {
  mode: "create" | "edit";
  initial: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}

function UserModal({ mode, initial, onClose, onSaved }: UserModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<UserFormData>(() => ({
    email: initial?.email || "",
    name: initial?.name || "",
    password: "",
    active: initial?.active ?? true,
  }));

  async function handleSave(): Promise<void> {
    setError("");

    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }

    if (mode === "create" && !form.password.trim()) {
      setError("Password is required for new users");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        email: form.email.trim(),
        name: form.name.trim() || null,
        active: form.active,
      };

      if (mode === "create") {
        payload.password = form.password;
        await adminCreateUser(payload);
      } else {
        await adminUpdateUser(initial!.id, payload);
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  const title = mode === "create" ? "Add New User" : "Edit User";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xl font-bold font-display">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            disabled={saving}
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              disabled={saving || mode === "edit"}
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Name
            </label>
            <input
              className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={saving}
              placeholder="Admin User"
            />
          </div>

          {mode === "create" && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                disabled={saving}
                placeholder="••••••••"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              id="active"
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((p) => ({ ...p, active: e.target.checked }))
              }
              disabled={saving}
              className="rounded border-slate-300 text-primary focus:ring-primary"
            />
            <label htmlFor="active" className="text-sm">
              Active
            </label>
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-primary hover:bg-red-700 text-white rounded-md disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PasswordModalProps {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}

function PasswordModal({ user, onClose, onSaved }: PasswordModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSave(): Promise<void> {
    setError("");

    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      await adminChangePassword(user.id, password);
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xl font-bold font-display">Change Password</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            disabled={saving}
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              Changing password for: <strong>{user.email}</strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              New Password
            </label>
            <input
              type="password"
              className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={saving}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-primary hover:bg-red-700 text-white rounded-md disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Changing..." : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState<
    "create" | "edit" | "password" | null
  >(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  async function loadUsers(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const data = await adminUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleDeleteClick(user: AdminUser): Promise<void> {
    setConfirmDelete(user);
  }

  async function confirmDeleteUser(): Promise<void> {
    if (!confirmDelete) return;
    const userToDelete = confirmDelete;
    setConfirmDelete(null);
    try {
      await adminDeleteUser(userToDelete.id);
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleEdit(user: AdminUser): void {
    setSelectedUser(user);
    setShowModal("edit");
  }

  function handleChangePassword(user: AdminUser): void {
    setSelectedUser(user);
    setShowModal("password");
  }

  function closeModal(): void {
    setShowModal(null);
    setSelectedUser(null);
  }

  async function handleSaved(): Promise<void> {
    await loadUsers();
    closeModal();
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display mb-2">Admin Users</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Manage admin user accounts and permissions
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal("create")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          Add User
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-slate-500">No users found</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-6 py-4 text-sm font-medium">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {user.name || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.active
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangePassword(user)}
                      className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 font-medium"
                    >
                      Password
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(user)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal === "create" && (
        <UserModal
          mode="create"
          initial={null}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {showModal === "edit" && selectedUser && (
        <UserModal
          mode="edit"
          initial={selectedUser}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {showModal === "password" && selectedUser && (
        <PasswordModal
          user={selectedUser}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete Admin User"
          message={`Are you sure you want to delete user "${confirmDelete.email}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          onConfirm={confirmDeleteUser}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
