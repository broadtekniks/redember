import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { getSettings } from "../lib/api";

interface Settings {
  primaryColor?: string;
  storeName?: string;
  storeDescription?: string;
  supportEmail?: string;
  logoUrl?: string;
  faviconUrl?: string;
}

interface SettingsContextType {
  settings: Settings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    primaryColor: "#e63946",
  });
  const [loading, setLoading] = useState(true);

  async function loadSettings(): Promise<void> {
    try {
      const data = await getSettings();
      setSettings({
        primaryColor: "#e63946",
        ...data,
      });

      // Apply primary color to CSS custom property
      if (data.primaryColor) {
        document.documentElement.style.setProperty(
          "--color-primary",
          data.primaryColor
        );
      }

      // Apply favicon
      if (data.faviconUrl) {
        updateFavicon(data.faviconUrl);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateFavicon(url: string): void {
    // Remove existing favicon links
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach((link) => link.remove());

    // Add new favicon link
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/x-icon";
    link.href = url;
    document.head.appendChild(link);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  // Apply primary color on settings change
  useEffect(() => {
    if (settings.primaryColor) {
      document.documentElement.style.setProperty(
        "--color-primary",
        settings.primaryColor
      );
    }
  }, [settings.primaryColor]);

  // Apply favicon on settings change
  useEffect(() => {
    if (settings.faviconUrl) {
      updateFavicon(settings.faviconUrl);
    }
  }, [settings.faviconUrl]);

  return (
    <SettingsContext.Provider
      value={{ settings, loading, refreshSettings: loadSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
