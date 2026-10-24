/**
 * OpenTill types
 */

export interface Tenant {
  id: string;
  name: string;
  businessType: string;
  taxRate: number; // e.g. 0.12 for 12%
  currency: string; // e.g. "USD", "EUR", "PHP"
  createdAt: string;
  active: boolean;
}

/** A login an admin created for the register of one store. */
export interface Cashier {
  id: string;
  name: string;
  username: string;
  tenantId: string;
  createdAt: string;
  /** The sign-in link: does one exist, how many devices used it, how many may. */
  hasLink: boolean;
  linkUses: number;
  linkMaxUses: number;
  /** Pages this cashier may open besides the Register and Account (see lib/cashier-pages). */
  pages: string[];
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  stock: number;
  description: string;
  // Optional: products cached before these existed won't have them.
  costPrice?: number;
  reorderLevel?: number;
  supplierId?: string | null;
  custom?: Record<string, string>;
  /** Optional photo as a small image data URL; missing or "" for none. */
  image?: string;
}

export const DEFAULT_REORDER_LEVEL = 5;
export const reorderLevel = (product: Product) => product.reorderLevel ?? DEFAULT_REORDER_LEVEL;
export const stockState = (product: Product): "out" | "low" | "ok" =>
  product.stock <= 0 ? "out" : product.stock <= reorderLevel(product) ? "low" : "ok";

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  active: boolean;
  custom?: Record<string, string>;
  createdAt: string;
}

export interface Expense {
  id: string;
  tenantId: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  supplierId: string | null;
  custom?: Record<string, string>;
  createdAt: string;
}

export type MovementType = "OPENING" | "RESTOCK" | "ADJUSTMENT" | "SALE";

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number; // signed
  unitCost: number | null;
  supplierId: string | null;
  note: string;
  date: string;
}

/** A product category the store has set up in Settings. Products store the category's name. */
export interface Category {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

export type CustomColumnTable = "products" | "suppliers" | "expenses";

export interface CustomColumn {
  id: string;
  tenantId: string;
  tableName: CustomColumnTable;
  label: string;
  type: "text" | "number" | "date";
  createdAt: string;
}

export type PaymentMethod = "CASH" | "CARD" | "MOBILE_WALLET";

export interface Order {
  id: string;
  tenantId: string;
  status: "COMPLETED" | "PENDING_SYNC" | "FAILED";
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  isOffline: boolean;
  date: string;
  syncedAt?: string;
  cashierName?: string;
  customerName?: string;
  discountAmount?: number;
  discountPercent?: number;
  cashReceived?: number;
  changeDue?: number;
  items?: OrderItem[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  email: string;
}

export interface HeldCart {
  id: string;
  tenantId: string;
  items: {
    product: Product;
    quantity: number;
  }[];
  date: string;
  label: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface SyncQueueItem {
  id: string;
  tenantId: string;
  order: Order;
  items: OrderItem[];
  timestamp: string;
}
