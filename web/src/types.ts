export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AdminAuthContextType {
  user: AdminUser | null;
  isAuthed: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface CartContextType {
  items: CartItem[];
  addToCart: (productId: string, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getTotalQuantity: () => number;
}

export const HEAT_PROFILE_VALUES = ["gentle", "standard", "inferno"] as const;
export type HeatProfileValue = (typeof HEAT_PROFILE_VALUES)[number];
export type HeatProfileDescriptions = Record<HeatProfileValue, string>;

export interface Product {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  currency: string;
  stock: number;
  description: string | null;
  imageUrl: string | null;

  heatIntensity?: number;
  heatProfile?: string;
  heatProfileDescriptions?: HeatProfileDescriptions;

  categoryId: string | null;
  variantName: string | null;
  requiresShipping: boolean;
  weightGrams: number | null;
  weightOz: number | null;
  weightG: number | null;
  volumeMl: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  active: boolean;
  bestSeller: boolean;
  createdAt: string;
  updatedAt: string;
  variantValues?: ProductVariantValue[];
}

export interface ProductCategory {
  id: string;
  name: string;
  handle: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantType {
  id: string;
  categoryId: string | null;
  scope?: string;
  isDefault?: boolean;
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantValue {
  id: string;
  productId: string;
  variantTypeId: string;
  value: string;
  createdAt: string;
  variantType?: ProductVariantType;
}

export interface ProductImage {
  id: string;
  categoryId: string;
  url: string;
  alt?: string;
  sortOrder: number;
  createdAt: string;
}

export interface Order {
  id: string;
  stripeSessionId: string;
  status: string;
  totalCents: number;
  currency: string;
  customerName?: string | null;
  customerEmail: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  priceCents: number;
  productName?: string | null;
}
