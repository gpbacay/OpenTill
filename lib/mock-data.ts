import { Tenant, Product, Order, OrderItem } from "@/lib/types";

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: "tenant-1",
    name: "Gourmet Bistro & Cafe",
    businessType: "Food & Beverage",
    taxRate: 0.10, // 10%
    currency: "USD",
    createdAt: "2026-01-15T08:00:00Z",
    active: true,
  },
  {
    id: "tenant-2",
    name: "NxtGen Tech Hub",
    businessType: "Electronics Retail",
    taxRate: 0.08, // 8%
    currency: "USD",
    createdAt: "2026-02-10T09:30:00Z",
    active: true,
  },
  {
    id: "tenant-3",
    name: "Aura Apparel",
    businessType: "Boutique Fashion",
    taxRate: 0.12, // 12%
    currency: "EUR",
    createdAt: "2026-03-01T10:00:00Z",
    active: true,
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  // Tenant 1: Gourmet Bistro
  {
    id: "prod-101",
    tenantId: "tenant-1",
    name: "Artisanal Avocado Toast",
    category: "Breakfast",
    sku: "AVO-TST-01",
    price: 12.50,
    stock: 45,
    description: "Sourdough toast with organic mashed avocado, cherry tomatoes, and microgreens.",
  },
  {
    id: "prod-102",
    tenantId: "tenant-1",
    name: "Cold Brew Draft Coffee",
    category: "Beverages",
    sku: "CLD-BRW-02",
    price: 4.75,
    stock: 120,
    description: "24-hour slow steeped specialty cold brew coffee.",
  },
  {
    id: "prod-103",
    tenantId: "tenant-1",
    name: "Truffle Parmesan Fries",
    category: "Sides",
    sku: "TRF-PM-03",
    price: 8.00,
    stock: 60,
    description: "Golden rustic cut fries tossed in real truffle oil and finely grated Parmigiano.",
  },
  {
    id: "prod-104",
    tenantId: "tenant-1",
    name: "Acai Berry Super Bowl",
    category: "Breakfast",
    sku: "ACI-BWL-04",
    price: 14.00,
    stock: 30,
    description: "Organic acai puree topped with strawberries, blueberries, hemp seeds, and honey.",
  },

  // Tenant 2: NxtGen Tech Hub
  {
    id: "prod-201",
    tenantId: "tenant-2",
    name: "Apex ANC Wireless Headphones",
    category: "Audio",
    sku: "APX-HDP-21",
    price: 249.99,
    stock: 15,
    description: "Active Noise Cancelling over-ear bluetooth headphones with 40-hr battery life.",
  },
  {
    id: "prod-202",
    tenantId: "tenant-2",
    name: "ErgoGlide Mechanical Keyboard",
    category: "Peripherals",
    sku: "ERG-KBD-22",
    price: 129.50,
    stock: 22,
    description: "Wireless split mechanical keyboard with Gateron brown tactile switches.",
  },
  {
    id: "prod-203",
    tenantId: "tenant-2",
    name: "Multi-Port USB-C Pro Dock",
    category: "Accessories",
    sku: "MPC-DCK-23",
    price: 79.99,
    stock: 40,
    description: "11-in-1 space gray desktop docking station supporting dual 4K monitors.",
  },

  // Tenant 3: Aura Apparel
  {
    id: "prod-301",
    tenantId: "tenant-3",
    name: "Minimalist Linen Overshirt",
    category: "Men",
    sku: "MNM-LN-11",
    price: 65.00,
    stock: 25,
    description: "Lightweight, breathable 100% Belgian linen overshirt in oatmeal.",
  },
  {
    id: "prod-302",
    tenantId: "tenant-3",
    name: "Silk Slip Dress",
    category: "Women",
    sku: "SLK-DRS-12",
    price: 110.00,
    stock: 18,
    description: "Premium mulberry silk maxi slip dress with elegant cowl neckline.",
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: "ord-1001",
    tenantId: "tenant-1",
    status: "COMPLETED",
    subtotal: 17.25,
    tax: 1.73,
    total: 18.98,
    paymentMethod: "MOBILE_WALLET",
    isOffline: false,
    date: "2026-07-12T14:22:15Z",
    syncedAt: "2026-07-12T14:22:16Z",
  },
  {
    id: "ord-1002",
    tenantId: "tenant-2",
    status: "COMPLETED",
    subtotal: 329.98,
    tax: 26.40,
    total: 356.38,
    paymentMethod: "CARD",
    isOffline: false,
    date: "2026-07-12T16:10:42Z",
    syncedAt: "2026-07-12T16:10:45Z",
  },
];

export const INITIAL_ORDER_ITEMS: OrderItem[] = [
  {
    id: "item-1001-1",
    orderId: "ord-1001",
    productId: "prod-101",
    name: "Artisanal Avocado Toast",
    price: 12.50,
    quantity: 1,
  },
  {
    id: "item-1001-2",
    orderId: "ord-1001",
    productId: "prod-102",
    name: "Cold Brew Draft Coffee",
    price: 4.75,
    quantity: 1,
  },
  {
    id: "item-1002-1",
    orderId: "ord-1002",
    productId: "prod-201",
    name: "Apex ANC Wireless Headphones",
    price: 249.99,
    quantity: 1,
  },
  {
    id: "item-1002-2",
    orderId: "ord-1002",
    productId: "prod-203",
    name: "Multi-Port USB-C Pro Dock",
    price: 79.99,
    quantity: 1,
  },
];
