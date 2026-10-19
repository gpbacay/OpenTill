import { Order, Product, Tenant } from "@/lib/types";

const DEMO_TENANTS = new Set(["tenant-1", "tenant-2", "tenant-3"]);
const DEMO_PRODUCTS = new Set([
  "prod-101",
  "prod-102",
  "prod-103",
  "prod-104",
  "prod-201",
  "prod-202",
  "prod-203",
  "prod-301",
  "prod-302",
]);
const DEMO_ORDERS = new Set(["ord-1001", "ord-1002"]);

export function stripDemoData(input: {
  tenants: Tenant[];
  products: Product[];
  orders: Order[];
}) {
  const products = input.products.filter((product) => !DEMO_PRODUCTS.has(product.id));
  const orders = input.orders.filter((order) => !DEMO_ORDERS.has(order.id));
  const tenants = input.tenants.filter((tenant) => {
    if (!DEMO_TENANTS.has(tenant.id)) return true;
    const hasCatalog = products.some((product) => product.tenantId === tenant.id);
    const hasSales = orders.some((order) => order.tenantId === tenant.id);
    return hasCatalog || hasSales;
  });
  return { tenants, products, orders };
}
