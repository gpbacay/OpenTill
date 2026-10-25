/**
 * Sample data for any store. Content lives in prisma/seed/data/*.json; this file only turns it into rows,
 * with every date generated relative to today so the dashboard and date filters always have a recent history.
 *
 *   npm run db:seed                                     test1's "JRS MOTOR PARTS" (created if missing), 60 days
 *   npm run db:seed -- --user alice --store "My Shop" --days 90
 *
 * Also reads SEED_USER, SEED_STORE and SEED_DAYS. Re-running replaces that store's earlier sample rows (ids start
 * with "seed-") and leaves everything you entered yourself alone.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DAY = 86_400_000;

const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > -1 ? process.argv[at + 1] : (process.env[`SEED_${name.toUpperCase()}`] ?? fallback);
};
const data = <T>(file: string): T => JSON.parse(readFileSync(path.join(__dirname, "seed", "data", file), "utf8"));

interface CatalogItem { name: string; category: string; sku: string; price: number; stock: number; supplier: string; custom: Record<string, string> }
interface SupplierItem { key: string; name: string; contactPerson: string; phone: string; email: string; address: string; active: boolean; custom: Record<string, string> }
interface ExpenseItem { category: string; description: string; amount: number; timesPerMonth: number }
interface ColumnItem { key: string; tableName: string; label: string; type: string }

let state = 42; // fixed seed: same shape every run, only the dates move
const rnd = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
const json = (value: Record<string, string>) => JSON.stringify(value);

async function main() {
  const username = arg("user", "test1");
  const storeName = arg("store", "JRS MOTOR PARTS");
  const days = Math.max(7, Number(arg("days", "60")) || 60);
  const now = Date.now();

  const user = await prisma.user.findUnique({ where: { email: username } });
  if (!user) throw new Error(`No user "${username}". Register it in the app first, or pass --user.`);
  let tenant = await prisma.tenant.findFirst({ where: { ownerId: user.id, name: storeName } });
  tenant ??= await prisma.tenant.create({
    data: { id: `tenant-${now}`, ownerId: user.id, name: storeName, businessType: "Motorcycle Parts", taxRate: 0, currency: "PHP" },
  });
  const tenantId = tenant.id;
  const tag = tenantId.replace(/\W/g, "").slice(-6);
  const id = (kind: string, n: string | number) => `seed-${tag}-${kind}-${n}`;

  const supplierRows = data<SupplierItem[]>("suppliers.json");
  const catalogRows = data<CatalogItem[]>("catalog.json");
  const expenseRows = data<ExpenseItem[]>("expenses.json");
  const columnRows = data<ColumnItem[]>("columns.json");
  const people = data<{ cashiers: string[]; customers: string[] }>("people.json");

  const columnId = (key: string) => id("col", key);
  const custom = (values: Record<string, string>) =>
    json(Object.fromEntries(Object.entries(values).map(([key, value]) => [columnId(key), value])));

  const suppliers = supplierRows.map((s) => ({
    id: id("sup", s.key), tenantId, name: s.name, contactPerson: s.contactPerson, phone: s.phone, email: s.email,
    address: s.address, notes: "", active: s.active, custom: custom(s.custom), createdAt: new Date(now - (days + 60) * DAY),
  }));
  const supplierId = (key: string) => id("sup", key);

  const products = catalogRows.map((p, i) => ({
    id: id("prod", String(i + 1).padStart(3, "0")), tenantId, name: p.name, category: p.category, sku: p.sku,
    price: p.price, stock: p.stock, description: `${p.name} - ${p.category.toLowerCase()} part.`,
    costPrice: Math.round(p.price * (0.6 + rnd() * 0.15)), reorderLevel: p.price > 1000 ? 3 : 5,
    supplierId: supplierId(p.supplier), brand: p.custom.brand ?? "", custom: custom(Object.fromEntries(Object.entries(p.custom).filter(([k]) => k !== "brand"))),
  }));

  // Orders spread across the window; the newest few are "queued", one is "failed", the rest are saved.
  const orders = [];
  const items = [];
  const sold = new Map<string, number>();
  for (let n = 1; n <= Math.round(days * 2); n++) {
    const orderId = id("ord", String(n).padStart(4, "0"));
    let date = new Date(now - (n === 1 ? 0.2 : rnd() * days) * DAY - rnd() * 3_600_000);
    date.setHours(8 + Math.floor(rnd() * 10), Math.floor(rnd() * 60));
    if (date.getTime() > now) date = new Date(date.getTime() - DAY);

    const lines = new Map<string, { product: (typeof products)[number]; qty: number }>();
    for (let k = 1 + Math.floor(rnd() * 4); k > 0; k--) {
      const product = pick(products);
      lines.set(product.id, { product, qty: (lines.get(product.id)?.qty ?? 0) + 1 + (rnd() < 0.2 ? 1 : 0) });
    }
    const subtotal = [...lines.values()].reduce((sum, l) => sum + l.product.price * l.qty, 0);
    const discountPercent = rnd() < 0.2 ? pick([5, 10]) : null;
    const discountAmount = discountPercent ? Math.round(subtotal * discountPercent) / 100 : null;
    const total = subtotal - (discountAmount ?? 0);
    const paymentMethod = pick(["CASH", "CASH", "CASH", "CARD", "MOBILE_WALLET"]);
    const status = n <= 3 ? "PENDING_SYNC" : n === 4 ? "FAILED" : "COMPLETED";
    const cashReceived = paymentMethod === "CASH" ? Math.ceil(total / 100) * 100 : null;
    orders.push({
      id: orderId, tenantId, status, subtotal, tax: 0, total, paymentMethod, isOffline: status === "PENDING_SYNC", date,
      syncedAt: status === "COMPLETED" ? date : null, cashierName: pick(people.cashiers),
      customerName: rnd() < 0.4 ? null : pick(people.customers), discountAmount, discountPercent, cashReceived,
      changeDue: cashReceived == null ? null : cashReceived - total,
    });
    let line = 0;
    for (const { product, qty } of lines.values()) {
      items.push({ id: id("item", `${n}-${++line}`), orderId, productId: product.id, name: product.name, price: product.price, quantity: qty });
      if (status === "COMPLETED") sold.set(product.id, (sold.get(product.id) ?? 0) + qty);
    }
  }

  // Stock ledger that adds up: opening + restocks + adjustments - sales = the stock shown on the product.
  const orderDate = new Map(orders.map((o) => [o.id, o]));
  const movements = items
    .filter((it) => orderDate.get(it.orderId)!.status === "COMPLETED")
    .map((it) => ({
      id: id("mov-sale", it.id.split("-").slice(-2).join("-")), tenantId, productId: it.productId, productName: it.name,
      type: "SALE", quantity: -it.quantity, unitCost: null as number | null, supplierId: null as string | null, note: "",
      date: orderDate.get(it.orderId)!.date,
    }));
  const expenses: Prisma.ExpenseCreateManyInput[] = [];
  products.forEach((p, i) => {
    const restock = i % 3 === 0 ? 12 : 0;
    const adjust = i % 7 === 0 ? -1 : 0;
    const base = { tenantId, productId: p.id, productName: p.name };
    movements.push({ ...base, id: id("mov-open", p.id.slice(-3)), type: "OPENING", quantity: p.stock + (sold.get(p.id) ?? 0) - restock - adjust, unitCost: p.costPrice, supplierId: p.supplierId, note: "Opening stock", date: new Date(now - (days + 15) * DAY) });
    if (restock) {
      const date = new Date(now - (5 + (i % Math.max(5, days - 10))) * DAY);
      movements.push({ ...base, id: id("mov-restock", p.id.slice(-3)), type: "RESTOCK", quantity: restock, unitCost: p.costPrice, supplierId: p.supplierId, note: "", date });
      expenses.push({
        id: id("exp-restock", p.id.slice(-3)), tenantId, date, category: "Inventory", description: `Restock ${restock} × ${p.name}`,
        amount: restock * p.costPrice, paymentMethod: "CASH", supplierId: p.supplierId, custom: "{}",
      });
    }
    if (adjust) movements.push({ ...base, id: id("mov-adjust", p.id.slice(-3)), type: "ADJUSTMENT", quantity: adjust, unitCost: null, supplierId: null, note: "Damaged: dropped in storage", date: new Date(now - (3 + (i % 10)) * DAY) });
  });

  // Recurring bills for every month the window touches.
  const months = Math.ceil(days / 30) + 1;
  for (let m = 0; m < months; m++) {
    expenseRows.forEach((e, i) => {
      for (let t = 0; t < Math.max(1, e.timesPerMonth); t++) {
        const date = new Date(now - (m * 30 + 2 + Math.floor(rnd() * 26)) * DAY);
        if (date.getTime() > now || (m === 0 && rnd() < 0.2)) continue;
        expenses.push({
          id: id("exp", `${m}-${i}-${t}`), tenantId, date, category: e.category, description: e.description,
          amount: Math.round(e.amount * (0.9 + rnd() * 0.2)), paymentMethod: pick(["CASH", "CASH", "MOBILE_WALLET", "CARD"]),
          supplierId: null, custom: custom({ receipt: `R-${1000 + Math.floor(rnd() * 8999)}` }),
        });
      }
    });
  }

  const mine = { tenantId, id: { startsWith: "seed-" } };
  const seededOrders = (await prisma.order.findMany({ where: mine, select: { id: true } })).map((o) => o.id);
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: { in: seededOrders } } }),
    prisma.order.deleteMany({ where: mine }),
    prisma.stockMovement.deleteMany({ where: mine }),
    prisma.expense.deleteMany({ where: mine }),
    prisma.product.deleteMany({ where: mine }),
    prisma.supplier.deleteMany({ where: mine }),
    prisma.customColumn.deleteMany({ where: mine }),
    prisma.customColumn.createMany({ data: columnRows.map((c) => ({ id: columnId(c.key), tenantId, tableName: c.tableName, label: c.label, type: c.type })) }),
    prisma.supplier.createMany({ data: suppliers }),
    prisma.product.createMany({ data: products }),
    prisma.order.createMany({ data: orders }),
    prisma.orderItem.createMany({ data: items }),
    prisma.stockMovement.createMany({ data: movements }),
    prisma.expense.createMany({ data: expenses }),
  ]);

  console.log(
    `Seeded "${tenant.name}" for ${username} (${days} days): ${suppliers.length} suppliers, ${products.length} products, ` +
      `${orders.length} orders, ${items.length} order items, ${movements.length} stock movements, ${expenses.length} expenses, ${columnRows.length} custom columns.`
  );
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
