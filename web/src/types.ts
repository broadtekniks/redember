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

export interface Product {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  currency: string;
  stock: number;
  description: string | null;
  imageUrl: string | null;
  groupId: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface ProductGroup {
  id: string;
  name: string;
  handle: string;
  createdAt: string;
  updatedAt: string;
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
