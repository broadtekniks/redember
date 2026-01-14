import { useEffect, useState } from "react";
import {
  adminGetSettings,
  adminUpdateSettings,
  adminUploadImage,
} from "../lib/api";
import { useSettings } from "../context/SettingsContext";

interface Settings {
  storeName: string;
  storeDescription: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  locale: string;
  taxRate: number;
  freeShippingThreshold: number;
  lowStockThreshold: number;
  enableLowStockAlerts: boolean;
  enableOrderNotifications: boolean;
  termsOfService: string;
  privacyPolicy: string;
  returnPolicy: string;
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
}

const DEFAULT_SETTINGS: Settings = {
  storeName: "Red Ember",
  storeDescription: "Premium small-batch chili oil",
  supportEmail: "support@redember.com",
  supportPhone: "",
  currency: "USD",
  locale: "en-US",
  taxRate: 0,
  freeShippingThreshold: 5000,
  lowStockThreshold: 10,
  enableLowStockAlerts: true,
  enableOrderNotifications: true,
  termsOfService: "",
  privacyPolicy: "",
  returnPolicy: "",
  primaryColor: "#ec131e",
  logoUrl: "",
  faviconUrl: "",
};

export default function AdminSettings() {
  const { refreshSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<
    "general" | "appearance" | "notifications" | "policies"
  >("general");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const data = await adminGetSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await adminUpdateSettings(settings);
      await refreshSettings(); // Refresh global settings to apply color changes
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateSetting<K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ): void {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogoUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError("");
    try {
      const result = await adminUploadImage(file, "branding");
      updateSetting("logoUrl", result.url);
    } catch (err: any) {
      setError(err.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleFaviconUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFavicon(true);
    setError("");
    try {
      const result = await adminUploadImage(file, "branding");
      updateSetting("faviconUrl", result.url);
    } catch (err: any) {
      setError(err.message || "Failed to upload favicon");
    } finally {
      setUploadingFavicon(false);
    }
  }

  const tabs = [
    { id: "general", label: "General", icon: "settings" },
    { id: "appearance", label: "Appearance", icon: "palette" },
    { id: "notifications", label: "Notifications", icon: "notifications" },
    { id: "policies", label: "Policies", icon: "description" },
  ] as const;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-display mb-2">
            Store Settings
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Configure your store identity, appearance, and preferences
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">
            {saving ? "hourglass_empty" : "save"}
          </span>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 rounded-lg px-4 py-3">
          <p className="text-sm text-green-700 dark:text-green-200">
            Settings saved successfully!
          </p>
        </div>
      )}

      <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-xl">
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">
              Loading settings...
            </div>
          ) : (
            <>
              {activeTab === "general" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Store Name
                      </label>
                      <input
                        type="text"
                        value={settings.storeName}
                        onChange={(e) =>
                          updateSetting("storeName", e.target.value)
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                        placeholder="Red Ember"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Support Email
                      </label>
                      <input
                        type="email"
                        value={settings.supportEmail}
                        onChange={(e) =>
                          updateSetting("supportEmail", e.target.value)
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                        placeholder="support@redember.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Support Phone
                      </label>
                      <input
                        type="tel"
                        value={settings.supportPhone}
                        onChange={(e) =>
                          updateSetting("supportPhone", e.target.value)
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Currency
                      </label>
                      <select
                        value={settings.currency}
                        onChange={(e) =>
                          updateSetting("currency", e.target.value)
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                      >
                        <option value="USD">USD ($) - US Dollar</option>
                        <option value="EUR">EUR (€) - Euro</option>
                        <option value="GBP">GBP (£) - British Pound</option>
                        <option value="CAD">CAD ($) - Canadian Dollar</option>
                        <option value="AUD">AUD ($) - Australian Dollar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={settings.taxRate}
                        onChange={(e) =>
                          updateSetting(
                            "taxRate",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Free Shipping Threshold (cents)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.freeShippingThreshold}
                        onChange={(e) =>
                          updateSetting(
                            "freeShippingThreshold",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                        placeholder="5000"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        $
                        {((settings.freeShippingThreshold || 0) / 100).toFixed(
                          2
                        )}{" "}
                        minimum for free shipping
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Low Stock Alert Threshold
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.lowStockThreshold}
                        onChange={(e) =>
                          updateSetting(
                            "lowStockThreshold",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                        placeholder="10"
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Store Description
                    </label>
                    <textarea
                      value={settings.storeDescription}
                      onChange={(e) =>
                        updateSetting("storeDescription", e.target.value)
                      }
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                      placeholder="Premium small-batch chili oil crafted with the finest ingredients"
                    />
                  </div>
                </div>
              )}

              {activeTab === "appearance" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Primary Brand Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.primaryColor}
                          onChange={(e) =>
                            updateSetting("primaryColor", e.target.value)
                          }
                          className="h-12 w-20 rounded-lg border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.primaryColor}
                          onChange={(e) =>
                            updateSetting("primaryColor", e.target.value)
                          }
                          className="flex-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm font-mono uppercase"
                          placeholder="#ec131e"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Used for buttons, links, and accents
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Logo
                      </label>
                      <div className="flex items-start gap-4">
                        {settings.logoUrl && (
                          <div className="flex-shrink-0">
                            <img
                              src={settings.logoUrl}
                              alt="Logo preview"
                              className="h-20 w-20 object-contain bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer transition-colors">
                            <span className="material-symbols-outlined text-lg">
                              {uploadingLogo ? "hourglass_empty" : "upload"}
                            </span>
                            <span className="text-sm font-medium">
                              {uploadingLogo
                                ? "Uploading..."
                                : settings.logoUrl
                                ? "Change Logo"
                                : "Upload Logo"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              disabled={uploadingLogo}
                              className="hidden"
                            />
                          </label>
                          <p className="text-xs text-slate-500 mt-2">
                            Recommended: 512x512px PNG or SVG
                          </p>
                          {settings.logoUrl && (
                            <button
                              type="button"
                              onClick={() => updateSetting("logoUrl", "")}
                              className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                            >
                              Remove logo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Favicon
                      </label>
                      <div className="flex items-start gap-4">
                        {settings.faviconUrl && (
                          <div className="flex-shrink-0">
                            <img
                              src={settings.faviconUrl}
                              alt="Favicon preview"
                              className="h-20 w-20 object-contain bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer transition-colors">
                            <span className="material-symbols-outlined text-lg">
                              {uploadingFavicon ? "hourglass_empty" : "upload"}
                            </span>
                            <span className="text-sm font-medium">
                              {uploadingFavicon
                                ? "Uploading..."
                                : settings.faviconUrl
                                ? "Change Favicon"
                                : "Upload Favicon"}
                            </span>
                            <input
                              type="file"
                              accept="image/*,.ico"
                              onChange={handleFaviconUpload}
                              disabled={uploadingFavicon}
                              className="hidden"
                            />
                          </label>
                          <p className="text-xs text-slate-500 mt-2">
                            Recommended: 32x32px ICO or PNG
                          </p>
                          {settings.faviconUrl && (
                            <button
                              type="button"
                              onClick={() => updateSetting("faviconUrl", "")}
                              className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                            >
                              Remove favicon
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Order Notifications
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Receive email alerts for new orders
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableOrderNotifications}
                      onChange={(e) =>
                        updateSetting(
                          "enableOrderNotifications",
                          e.target.checked
                        )
                      }
                      className="rounded border-slate-300 text-primary focus:ring-primary w-5 h-5"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Low Stock Alerts
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Get notified when inventory runs low
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableLowStockAlerts}
                      onChange={(e) =>
                        updateSetting("enableLowStockAlerts", e.target.checked)
                      }
                      className="rounded border-slate-300 text-primary focus:ring-primary w-5 h-5"
                    />
                  </div>
                </div>
              )}

              {activeTab === "policies" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Terms of Service
                    </label>
                    <textarea
                      value={settings.termsOfService}
                      onChange={(e) =>
                        updateSetting("termsOfService", e.target.value)
                      }
                      rows={6}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                      placeholder="Enter your terms of service..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Privacy Policy
                    </label>
                    <textarea
                      value={settings.privacyPolicy}
                      onChange={(e) =>
                        updateSetting("privacyPolicy", e.target.value)
                      }
                      rows={6}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                      placeholder="Enter your privacy policy..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Return & Refund Policy
                    </label>
                    <textarea
                      value={settings.returnPolicy}
                      onChange={(e) =>
                        updateSetting("returnPolicy", e.target.value)
                      }
                      rows={6}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-sm"
                      placeholder="Enter your return policy..."
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
