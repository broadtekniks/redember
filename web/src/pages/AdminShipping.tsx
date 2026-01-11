import { useState, useEffect } from "react";
import { adminGetShipping, adminUpdateShippingZone } from "../lib/api";

interface WeightTier {
  id?: string;
  minWeightG: number;
  maxWeightG: number;
  rateCents: number;
}

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  enabled: boolean;
  freeShippingMin: number | null;
  weightTiers: WeightTier[];
}

interface CarrierIntegration {
  id: string;
  name: string;
  logo: string;
  description: string;
  connected: boolean;
  apiKey?: string;
}

type ShippingTab = "zones" | "carriers" | "packaging";

export default function AdminShipping() {
  const [activeTab, setActiveTab] = useState<ShippingTab>("zones");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<ShippingZone | null>(null);

  const [carriers] = useState<CarrierIntegration[]>([
    {
      id: "fedex",
      name: "FedEx Web Services",
      logo: "https://upload.wikimedia.org/wikipedia/commons/9/9d/FedEx_Express.svg",
      description:
        "Real-time dynamic rates and automated labels for express shipping.",
      connected: false,
    },
    {
      id: "ups",
      name: "UPS Ground & Air",
      logo: "https://upload.wikimedia.org/wikipedia/commons/c/ce/Ups-logo.svg",
      description:
        "Connect your UPS account to offer calculated rates at checkout.",
      connected: false,
    },
  ]);

  useEffect(() => {
    loadShippingConfig();
  }, []);

  async function loadShippingConfig() {
    try {
      setLoading(true);
      setError("");
      const data = await adminGetShipping();
      setZones(data.zones || []);
      if (data.zones && data.zones.length > 0) {
        setSelectedZone(data.zones[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load shipping configuration");
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    if (!selectedZone) return;

    try {
      setSaving(true);
      setError("");
      await adminUpdateShippingZone(selectedZone.id, {
        name: selectedZone.name,
        countries: selectedZone.countries,
        enabled: selectedZone.enabled,
        freeShippingMin: selectedZone.freeShippingMin,
        weightTiers: selectedZone.weightTiers,
      });
      await loadShippingConfig();
    } catch (err: any) {
      setError(err.message || "Failed to save shipping configuration");
    } finally {
      setSaving(false);
    }
  };

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatWeight = (grams: number) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(1)}kg`;
    }
    return `${grams}g`;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-12">
          <p className="text-stone-500 dark:text-stone-400">
            Loading shipping configuration...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#1b0d0e] dark:text-white">
              Shipping Configuration
            </h2>
            <p className="text-[#9a4c50] text-sm mt-1">
              Manage shipping zones, weight-based rates, and carrier
              integrations.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex-1 sm:flex-none px-4 h-10 border border-[#e7cfd0] dark:border-[#3d2122] rounded-lg text-sm font-bold hover:bg-white dark:hover:bg-[#1b0d0e] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 sm:flex-none px-6 h-10 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-[#c40e18] transition-all"
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 sm:mt-8 border-b border-[#e7cfd0] dark:border-[#3d2122] flex gap-4 sm:gap-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("zones")}
            className={`pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === "zones"
                ? "border-b-[3px] border-primary text-[#1b0d0e] dark:text-white"
                : "border-b-[3px] border-transparent text-[#9a4c50] hover:text-primary"
            }`}
          >
            Shipping Zones
          </button>
          <button
            onClick={() => setActiveTab("carriers")}
            className={`pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === "carriers"
                ? "border-b-[3px] border-primary text-[#1b0d0e] dark:text-white"
                : "border-b-[3px] border-transparent text-[#9a4c50] hover:text-primary"
            }`}
          >
            Carrier Integration
          </button>
          <button
            onClick={() => setActiveTab("packaging")}
            className={`pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === "packaging"
                ? "border-b-[3px] border-primary text-[#1b0d0e] dark:text-white"
                : "border-b-[3px] border-transparent text-[#9a4c50] hover:text-primary"
            }`}
          >
            Packaging Defaults
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "zones" && selectedZone && (
        <div className="space-y-8">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Shipping Zone Section */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xl sm:text-2xl font-bold">
                  {selectedZone.name}
                </h3>
                {zones.length > 1 && (
                  <select
                    className="bg-transparent border border-stone-200 dark:border-stone-800 rounded-md px-2 py-1 text-sm font-semibold focus:ring-2 focus:ring-primary cursor-pointer text-stone-900 dark:text-white"
                    value={selectedZone.id}
                    onChange={(e) => {
                      const next = zones.find((z) => z.id === e.target.value);
                      if (next) setSelectedZone(next);
                    }}
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <span
                className={`px-2 py-1 text-xs font-bold rounded ${
                  selectedZone.enabled
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                }`}
              >
                {selectedZone.enabled ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="space-y-6">
              {/* Weight-Based Rates Card */}
              <div className="bg-white dark:bg-[#1b0d0e] border border-[#e7cfd0] dark:border-[#3d2122] rounded-xl overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-[#e7cfd0] dark:border-[#3d2122] flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex gap-3 sm:gap-4">
                    <div className="size-10 sm:size-12 flex-shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">
                        monitor_weight
                      </span>
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-bold">
                        Weight-Based Rates
                      </h4>
                      <p className="text-xs sm:text-sm text-[#9a4c50] mt-0.5">
                        Optimized for 50ml and 70ml glass bottle shipments.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#9a4c50]">
                      {selectedZone.enabled ? "ENABLED" : "DISABLED"}
                    </span>
                    <button
                      onClick={() =>
                        setSelectedZone({
                          ...selectedZone,
                          enabled: !selectedZone.enabled,
                        })
                      }
                      className={`w-10 h-5 rounded-full relative transition-colors ${
                        selectedZone.enabled
                          ? "bg-primary"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <div
                        className={`absolute top-1 size-3 bg-white rounded-full transition-all ${
                          selectedZone.enabled ? "right-1" : "left-1"
                        }`}
                      ></div>
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6 overflow-x-auto">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="text-[#9a4c50] text-xs uppercase tracking-wider border-b border-[#f3e7e8] dark:border-[#3d2122]">
                        <th className="pb-3 font-bold">Weight Range</th>
                        <th className="pb-3 font-bold">Rate</th>
                        <th className="pb-3"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {selectedZone.weightTiers.map((tier, index) => (
                        <tr
                          key={tier.id || index}
                          className={
                            index < selectedZone.weightTiers.length - 1
                              ? "border-b border-[#f8f6f6] dark:border-[#2a1617]"
                              : ""
                          }
                        >
                          <td className="py-4 font-medium">
                            {formatWeight(tier.minWeightG)} -{" "}
                            {formatWeight(tier.maxWeightG)}
                          </td>
                          <td className="py-4 text-[#9a4c50]">
                            {formatMoney(tier.rateCents)}
                          </td>
                          <td className="py-4 text-right">
                            <button className="text-[#9a4c50] hover:text-primary transition-colors">
                              <span className="material-symbols-outlined text-lg">
                                edit
                              </span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="mt-4 flex items-center gap-2 text-primary text-sm font-bold hover:underline">
                    <span className="material-symbols-outlined text-lg">
                      add_circle
                    </span>
                    Add Weight Tier
                  </button>
                </div>
              </div>

              {/* Free Shipping Threshold */}
              <div className="bg-white dark:bg-[#1b0d0e] border border-[#e7cfd0] dark:border-[#3d2122] rounded-xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex gap-3 sm:gap-4 items-start sm:items-center">
                    <div className="size-10 flex-shrink-0 rounded-lg bg-[#f3e7e8] dark:bg-[#3d2122] flex items-center justify-center">
                      <span className="material-symbols-outlined">
                        celebration
                      </span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold">
                        Free Shipping Promotion
                      </h4>
                      <p className="text-xs sm:text-sm text-[#9a4c50] mt-0.5">
                        Offer free shipping once a subtotal threshold is
                        reached.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center border border-[#e7cfd0] dark:border-[#3d2122] rounded-lg overflow-hidden">
                      <span className="px-3 py-2 bg-[#f8f6f6] dark:bg-[#2a1617] text-[#9a4c50] text-sm border-r border-[#e7cfd0] dark:border-[#3d2122]">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={
                          selectedZone.freeShippingMin
                            ? (selectedZone.freeShippingMin / 100).toFixed(2)
                            : "75.00"
                        }
                        onChange={(e) =>
                          setSelectedZone({
                            ...selectedZone,
                            freeShippingMin: Math.round(
                              parseFloat(e.target.value) * 100
                            ),
                          })
                        }
                        className="w-20 px-3 py-2 bg-white dark:bg-[#1b0d0e] text-sm"
                        disabled={saving || !selectedZone.freeShippingMin}
                      />
                    </div>
                    <button
                      onClick={() =>
                        setSelectedZone({
                          ...selectedZone,
                          freeShippingMin: selectedZone.freeShippingMin
                            ? null
                            : 7500,
                        })
                      }
                      disabled={saving}
                      className={`w-10 h-5 rounded-full relative transition-colors ${
                        selectedZone.freeShippingMin
                          ? "bg-primary"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <div
                        className={`absolute top-1 size-3 bg-white rounded-full transition-all ${
                          selectedZone.freeShippingMin ? "right-1" : "left-1"
                        }`}
                      ></div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* International Shipping Preview */}
          <section className="opacity-60 pointer-events-none">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xl sm:text-2xl font-bold">
                  International Shipping
                </h3>
                <span className="material-symbols-outlined text-[#9a4c50]">
                  lock
                </span>
              </div>
            </div>
            <div className="border-2 border-dashed border-[#e7cfd0] dark:border-[#3d2122] rounded-xl p-8 sm:p-12 text-center">
              <p className="text-sm text-[#9a4c50]">
                Configure worldwide shipping zones and customs declarations.
              </p>
              <button className="mt-4 text-sm font-bold text-primary">
                Setup International Zones
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === "carriers" && (
        <section className="space-y-6">
          <h3 className="text-xl sm:text-2xl font-bold px-2">
            Carrier Integration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {carriers.map((carrier) => (
              <div
                key={carrier.id}
                className="bg-white dark:bg-[#1b0d0e] border border-[#e7cfd0] dark:border-[#3d2122] rounded-xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-6"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="h-8 w-24 flex items-center">
                    <span className="text-lg font-bold text-[#9a4c50]">
                      {carrier.id === "fedex" ? "FedEx" : "UPS"}
                    </span>
                  </div>
                  <span
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full ${
                      carrier.connected
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-[#f3e7e8] text-[#9a4c50] dark:bg-[#3d2122]"
                    }`}
                  >
                    {carrier.connected && (
                      <span className="size-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    )}
                    {carrier.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-bold">{carrier.name}</h4>
                  <p className="text-sm text-[#9a4c50] mt-1">
                    {carrier.description}
                  </p>
                </div>
                <div className="mt-auto pt-4 border-t border-[#f8f6f6] dark:border-[#2a1617] flex justify-between items-center">
                  <span className="text-xs text-[#9a4c50]">
                    {carrier.connected
                      ? `API Key: ${carrier.apiKey}`
                      : "Not configured"}
                  </span>
                  <button
                    className={`text-sm font-bold ${
                      carrier.connected
                        ? "text-primary hover:text-primary/80"
                        : "px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20"
                    } transition-colors`}
                  >
                    {carrier.connected ? "Configure" : "Connect Account"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "packaging" && (
        <section className="space-y-6">
          <h3 className="text-xl sm:text-2xl font-bold px-2">
            Default Packaging Settings
          </h3>
          <div className="bg-white dark:bg-[#1b0d0e] border border-[#e7cfd0] dark:border-[#3d2122] rounded-xl p-4 sm:p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">
                  Default Box Dimensions
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[#9a4c50] mb-1">
                      Length (cm)
                    </label>
                    <input
                      type="number"
                      defaultValue={20}
                      className="w-full px-3 py-2 bg-[#f8f6f6] dark:bg-[#2a1617] border border-[#e7cfd0] dark:border-[#3d2122] rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9a4c50] mb-1">
                      Width (cm)
                    </label>
                    <input
                      type="number"
                      defaultValue={15}
                      className="w-full px-3 py-2 bg-[#f8f6f6] dark:bg-[#2a1617] border border-[#e7cfd0] dark:border-[#3d2122] rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9a4c50] mb-1">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      defaultValue={10}
                      className="w-full px-3 py-2 bg-[#f8f6f6] dark:bg-[#2a1617] border border-[#e7cfd0] dark:border-[#3d2122] rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">
                  Package Weight Buffer
                </label>
                <p className="text-xs text-[#9a4c50] mb-3">
                  Additional weight added for packaging materials (bubble wrap,
                  box, etc.)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={50}
                    className="w-24 px-3 py-2 bg-[#f8f6f6] dark:bg-[#2a1617] border border-[#e7cfd0] dark:border-[#3d2122] rounded-lg text-sm"
                  />
                  <span className="text-sm text-[#9a4c50]">grams</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#e7cfd0] dark:border-[#3d2122]">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="signature"
                    className="rounded border-[#e7cfd0] text-primary focus:ring-primary"
                    defaultChecked
                  />
                  <label htmlFor="signature" className="text-sm">
                    Require signature confirmation for orders over $100
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
