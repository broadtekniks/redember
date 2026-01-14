import React, { useEffect, useState } from "react";
import {
  adminGetMediaLibrary,
  adminUploadImage,
  adminAddMediaLibraryImage,
} from "../lib/api";

interface MediaImage {
  id: string;
  url: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  alt?: string;
  createdAt: string;
  updatedAt?: string;
  isUsed?: boolean;
  usageCount?: number;
}

interface MediaGalleryProps {
  onClose: () => void;
  onSelect: (mediaIds: string[]) => void;
  multiSelect?: boolean;
}

export function MediaGallery({
  onClose,
  onSelect,
  multiSelect = false,
}: MediaGalleryProps) {
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    loadMediaLibrary();
  }, []);

  async function loadMediaLibrary() {
    try {
      setLoading(true);
      const data = await adminGetMediaLibrary();
      console.log('Media library data:', data);
      setImages(data || []);
    } catch (err: any) {
      console.error('Error loading media library:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError("");
    setUploading(true);

    try {
      // Upload files to storage
      const uploadPromises = Array.from(files).map((file) =>
        adminUploadImage(file, "products")
      );
      const results = await Promise.all(uploadPromises);

      // Save uploaded images to database as media library entries
      const savePromises = results.map((result, index) =>
        adminAddMediaLibraryImage({
          url: result.url,
          filename: files[index].name,
          size: files[index].size,
          mimeType: files[index].type,
          alt: "",
        })
      );
      const mediaRecords = await Promise.all(savePromises);
      console.log('Uploaded media records:', mediaRecords);

      // Refresh the media library
      await loadMediaLibrary();

      // Auto-select uploaded media by ID
      if (mediaRecords.length > 0) {
        const mediaIds = mediaRecords.map((m) => m.id);
        onSelect(mediaIds);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function toggleImageSelection(mediaId: string) {
    if (!multiSelect) {
      // Single select mode - immediately select and close
      onSelect([mediaId]);
      return;
    }

    const newSelection = new Set(selectedImages);
    if (newSelection.has(mediaId)) {
      newSelection.delete(mediaId);
    } else {
      newSelection.add(mediaId);
    }
    setSelectedImages(newSelection);
  }

  function handleSelectMultiple() {
    if (selectedImages.size === 0) return;
    onSelect(Array.from(selectedImages));
  }

  const filteredImages = images.filter((img) => {
    if (!searchTerm) return true;
    return (
      img.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      img.alt?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-6xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black tracking-tight">Media Library</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Select an image or upload new media
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="relative">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <button
              type="button"
              disabled={uploading}
              className="px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">
                {uploading ? "hourglass_empty" : "cloud_upload"}
              </span>
              {uploading ? "Uploading..." : "Upload Images"}
            </button>
          </div>

          {multiSelect && selectedImages.size > 0 && (
            <button
              type="button"
              onClick={handleSelectMultiple}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-colors"
            >
              Select ({selectedImages.size})
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-400 flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin">
                  refresh
                </span>
                <span>Loading media library...</span>
              </div>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <span className="material-symbols-outlined text-6xl mb-4">
                photo_library
              </span>
              <p className="text-lg font-medium">No images found</p>
              <p className="text-sm mt-1">
                {searchTerm
                  ? "Try a different search term"
                  : "Upload your first image to get started"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredImages.map((image) => (
                <div
                  key={image.id}
                  onClick={() => toggleImageSelection(image.id)}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:shadow-lg ${
                    selectedImages.has(image.id)
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                  }`}
                >
                  <div className="aspect-square bg-slate-100 dark:bg-slate-950">
                    <img
                      src={image.url}
                      alt={image.alt || "Media"}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
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

                  {/* Badge for used images */}
                  {image.isUsed && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      USED ({image.usageCount})
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <div>{filteredImages.length} images</div>
          <div>Click an image to select it for your product</div>
        </div>
      </div>
    </div>
  );
}
