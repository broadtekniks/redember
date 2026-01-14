import { useEffect, useState } from "react";
import { adminGetMedia, adminUploadImage, adminDeleteMedia } from "../lib/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import ConfirmModal from "../components/ConfirmModal";

interface MediaItem {
  url: string;
  key: string;
  size?: number;
  lastModified?: string;
}

export default function AdminMediaGallery() {
  const { isAuthed } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<"all" | "branding" | "product-images">(
    "all"
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MediaItem | null>(null);

  useEffect(() => {
    if (isAuthed) {
      loadMedia();
    }
  }, [isAuthed, filter]);

  async function loadMedia() {
    setLoading(true);
    setError("");
    try {
      const folder = filter === "all" ? undefined : filter;
      const items = await adminGetMedia(folder);
      setMedia(Array.isArray(items) ? items : []);
    } catch (err: any) {
      setError(err.message);
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError("");

    try {
      const folder = filter === "all" ? "product-images" : filter;
      for (const file of Array.from(files)) {
        await adminUploadImage(file, folder);
      }
      await loadMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;

    setLoading(true);
    setError("");

    try {
      await adminDeleteMedia(confirmDelete.key);
      await loadMedia();
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  function copyToClipboard(url: string) {
    navigator.clipboard.writeText(url);
    setSelectedImage(url);
    setTimeout(() => setSelectedImage(null), 2000);
  }

  const filteredMedia = media.filter((item) => {
    if (filter === "all") return true;
    return item.key.startsWith(filter);
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white font-display">
            Media Gallery
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Upload and manage reusable images for products and branding
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 shadow-md transition-all active:scale-95 disabled:opacity-60 cursor-pointer">
            <span className="material-symbols-outlined text-xl mr-2">
              upload
            </span>
            Upload Images
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              disabled={!isAuthed || uploading || loading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {(["all", "product-images", "branding"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              filter === tab
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
            disabled={loading}
          >
            {tab === "all"
              ? "All Images"
              : tab === "product-images"
              ? "Product Images"
              : "Branding"}
          </button>
        ))}
      </div>

      {/* Image Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm p-6">
        {!isAuthed ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enter your admin token to manage media.
            </p>
          </div>
        ) : loading && media.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading...
            </p>
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">
              photo_library
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No images found. Upload some to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredMedia.map((item) => (
              <div
                key={item.key}
                className={`relative group aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 transition-all cursor-pointer ${
                  selectedImage === item.url
                    ? "border-green-500 ring-2 ring-green-500/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-primary"
                }`}
                onClick={() => copyToClipboard(item.url)}
              >
                <img
                  src={item.url}
                  alt={item.key}
                  className="w-full h-full object-cover"
                />

                {/* Copied Indicator */}
                {selectedImage === item.url && (
                  <div className="absolute inset-0 bg-green-500/90 flex items-center justify-center">
                    <div className="text-white text-center">
                      <span className="material-symbols-outlined text-3xl mb-1">
                        check_circle
                      </span>
                      <p className="text-xs font-medium">Copied!</p>
                    </div>
                  </div>
                )}

                {/* Hover Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(item.url);
                    }}
                    className="p-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-primary hover:text-white transition-colors shadow-lg"
                    title="Copy URL"
                  >
                    <span className="material-symbols-outlined text-lg">
                      content_copy
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(item);
                    }}
                    className="p-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-red-600 hover:text-white transition-colors shadow-lg"
                    title="Delete"
                    disabled={loading}
                  >
                    <span className="material-symbols-outlined text-lg">
                      delete
                    </span>
                  </button>
                </div>

                {/* File Info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white truncate">
                    {item.key.split("/").pop()}
                  </p>
                  {item.size && (
                    <p className="text-[9px] text-slate-300">
                      {(item.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
          Click any image to copy its URL to clipboard
        </p>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete Image"
          message={`Are you sure you want to delete "${confirmDelete.key}"? This will permanently remove it from storage and cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
