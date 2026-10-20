// Dummy data for test1's "JRS MOTOR PARTS" store. Re-runnable: wipes its own "seed-*" rows first.
// Usage: node scripts/seed-jrs.cjs   (stop the API first if you just changed prisma/schema.prisma)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: "file:../data/opentill.db" } } });

let s = 42; // deterministic PRNG so every run produces the same data
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const DAY = 86400000;

const SUPPLIERS = [
  ["seed-sup-1", "Motul Philippines Distribution", "Carlo Mendoza", "0917 555 0101", "orders@motul-dist.example", "Quezon City"],
  ["seed-sup-2", "NGK Spark Plug Trading", "Liza Tan", "0918 555 0102", "sales@ngk-trading.example", "Mandaluyong"],
  ["seed-sup-3", "Yamaha Genuine Parts Hub", "Ramon Dizon", "0919 555 0103", "parts@yamaha-hub.example", "Pasig"],
  ["seed-sup-4", "Honda Parts Wholesale", "Joy Bautista", "0920 555 0104", "wholesale@honda-parts.example", "Caloocan"],
  ["seed-sup-5", "Kalye Moto Accessories", "Boy Santos", "0921 555 0105", "kalyemoto@example.com", "Divisoria, Manila"],
  ["seed-sup-6", "Old Tire Depot (inactive)", "", "0922 555 0106", "", "Valenzuela"],
];

// name, category, sku, price, stock, brand, shelf, supplier index
const CATALOG = [
  ["Engine Oil 10W-40 1L", "Oils & Fluids", "OIL-1040-1L", 285, 48, "Motul", "A1", 0],
  ["Engine Oil 20W-50 1L", "Oils & Fluids", "OIL-2050-1L", 260, 36, "Motul", "A1", 0],
  ["Gear Oil 80W-90 120ml", "Oils & Fluids", "OIL-GEAR-120", 85, 60, "Motul", "A2", 0],
  ["Brake Fluid DOT3 250ml", "Oils & Fluids", "FLD-DOT3-250", 150, 22, "Prestone", "A2", 0],
  ["Coolant 1L", "Oils & Fluids", "FLD-COOL-1L", 180, 14, "Prestone", "A2", 0],
  ["Spark Plug NGK CPR8EA-9", "Engine", "ENG-NGK-CPR8", 195, 40, "NGK", "B1", 1],
  ["Spark Plug NGK C7HSA", "Engine", "ENG-NGK-C7HSA", 120, 55, "NGK", "B1", 1],
  ["Air Filter Mio i125", "Engine", "ENG-AF-MIO125", 220, 18, "Yamaha", "B2", 2],
  ["Air Filter Click 125", "Engine", "ENG-AF-CLK125", 240, 4, "Honda", "B2", 3],
  ["Oil Filter Universal", "Engine", "ENG-OF-UNI", 140, 30, "Hiflo", "B2", 3],
  ["Piston Kit 53mm", "Engine", "ENG-PK-53", 1450, 6, "Yamaha", "B3", 2],
  ["Gasket Set Raider 150", "Engine", "ENG-GS-RDR150", 680, 9, "Suzuki", "B3", 3],
  ["Brake Pad Front Mio", "Brakes", "BRK-BP-MIOF", 320, 25, "Yamaha", "C1", 2],
  ["Brake Pad Rear Click", "Brakes", "BRK-BP-CLKR", 290, 3, "Honda", "C1", 3],
  ["Brake Shoe Rear Smash", "Brakes", "BRK-BS-SMSH", 210, 17, "Suzuki", "C1", 3],
  ["Brake Disc 220mm", "Brakes", "BRK-DISC-220", 1250, 5, "RCB", "C2", 4],
  ["Brake Lever Universal", "Brakes", "BRK-LVR-UNI", 175, 20, "RCB", "C2", 4],
  ["Drive Chain 428H-120L", "Drivetrain", "DRV-CH-428-120", 780, 12, "DID", "D1", 3],
  ["Drive Chain 520-120L", "Drivetrain", "DRV-CH-520-120", 1650, 7, "DID", "D1", 3],
  ["Sprocket Set Raider 150", "Drivetrain", "DRV-SP-RDR", 1100, 8, "Suzuki", "D1", 3],
  ["CVT Belt Mio i125", "Drivetrain", "DRV-BELT-MIO", 650, 11, "Yamaha", "D2", 2],
  ["Clutch Lining Set", "Drivetrain", "DRV-CL-SET", 540, 0, "Honda", "D2", 3],
  ["Front Tire 70/90-17", "Tires & Wheels", "TIR-F-709017", 1350, 10, "Pirelli", "E1", 4],
  ["Rear Tire 80/90-17", "Tires & Wheels", "TIR-R-809017", 1580, 9, "Pirelli", "E1", 4],
  ["Inner Tube 17in", "Tires & Wheels", "TIR-TUBE-17", 195, 34, "Swallow", "E2", 4],
  ["Tire Valve Stem (pair)", "Tires & Wheels", "TIR-VLV", 45, 80, "Generic", "E2", 4],
  ["Battery YTX5L-BS", "Electrical", "ELC-BAT-YTX5L", 1250, 8, "Motolite", "F1", 3],
  ["Battery 12N7A", "Electrical", "ELC-BAT-12N7A", 980, 2, "Motolite", "F1", 3],
  ["LED Headlight H4", "Electrical", "ELC-LED-H4", 560, 15, "Osram", "F2", 4],
  ["Turn Signal Set LED", "Electrical", "ELC-TS-LED", 240, 26, "Generic", "F2", 4],
  ["Horn 12V", "Electrical", "ELC-HORN-12V", 180, 19, "Generic", "F2", 4],
  ["Rectifier Regulator Mio", "Electrical", "ELC-RR-MIO", 690, 6, "Yamaha", "F3", 2],
  ["Side Mirror Pair", "Accessories", "ACC-MIR-PR", 260, 28, "Generic", "G1", 4],
  ["Handle Grip Rubber", "Accessories", "ACC-GRIP", 130, 32, "Domino", "G1", 4],
  ["Helmet Half-Face", "Accessories", "ACC-HLM-HF", 850, 14, "MT Helmets", "G2", 4],
  ["Phone Holder Handlebar", "Accessories", "ACC-PH-HOLD", 320, 21, "Generic", "G2", 4],
  ["Chain Lube 150ml", "Accessories", "ACC-LUBE-150", 165, 44, "Motul", "G1", 0],
  ["Throttle Cable", "Cables", "CBL-THR", 110, 23, "Generic", "H1", 4],
  ["Clutch Cable", "Cables", "CBL-CLT", 120, 1, "Generic", "H1", 4],
  ["Speedometer Cable", "Cables", "CBL-SPD", 135, 16, "Generic", "H1", 4],
];
const CASHIERS = ["Jun Reyes", "Marites Cruz", "Ronnie Dela Peña"];
const CUSTOMERS = [null, null, null, "Walk-in", "Mang Berto", "Kuya Dodong Garage", "Ate Liza", "Cabral Delivery", "Toto's Repair Shop"];
const EXPENSES = [
  ["Rent", "Monthly shop rent", 18000, 1],
  ["Utilities", "Electricity bill", 4200, 0],
  ["Utilities", "Water bill", 650, 0],
  ["Utilities", "Internet", 1599, 0],
  ["Salaries", "Cashier salary (Jun)", 9500, 1],
  ["Salaries", "Helper salary", 8000, 1],
  ["Transport", "Delivery fuel", 800, 3],
  ["Supplies", "Receipt paper rolls", 450, 1],
  ["Maintenance", "Signage repair", 1200, 1],
  ["Marketing", "Facebook page boost", 500, 2],
  ["Supplies", "Plastic bags & cleaning", 380, 4],
  ["Transport", "Jeep fare to supplier", 120, 6],
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "test1" } });
  if (!user) throw new Error("User test1 not found");
  const tenant = await prisma.tenant.findFirst({ where: { ownerId: user.id, name: "JRS MOTOR PARTS" } });
  if (!tenant) throw new Error("Tenant JRS MOTOR PARTS not found for test1");
  const tenantId = tenant.id;

  // clear previous seed
  for (const model of ["orderItem", "order", "product", "supplier", "expense", "stockMovement", "customColumn"]) {
    await prisma[model].deleteMany({ where: { id: { startsWith: "seed-" } } });
  }

  await prisma.supplier.createMany({
    data: SUPPLIERS.map(([id, name, contactPerson, phone, email, address], i) => ({
      id, tenantId, name, contactPerson, phone, email, address, notes: "", active: i !== 5,
      custom: JSON.stringify({ "seed-col-terms": i < 2 ? "Net 30" : i < 4 ? "Net 15" : "COD" }),
      createdAt: new Date(Date.now() - 120 * DAY),
    })),
  });

  // User-defined columns, as a user would add them from the "Columns" button.
  await prisma.customColumn.createMany({
    data: [
      { id: "seed-col-brand", tenantId, tableName: "products", label: "Brand", type: "text" },
      { id: "seed-col-shelf", tenantId, tableName: "products", label: "Shelf", type: "text" },
      { id: "seed-col-terms", tenantId, tableName: "suppliers", label: "Payment terms", type: "text" },
      { id: "seed-col-ref", tenantId, tableName: "expenses", label: "Receipt no.", type: "text" },
    ],
  });

  const products = CATALOG.map(([name, category, sku, price, stock, brand, shelf, sup], i) => ({
    id: `seed-prod-${String(i + 1).padStart(3, "0")}`,
    tenantId, name, category, sku, price, stock,
    description: `${name} - ${category.toLowerCase()} part for Philippine-market motorcycles.`,
    costPrice: Math.round(price * (0.6 + rnd() * 0.15)),
    reorderLevel: price > 1000 ? 3 : 5,
    supplierId: SUPPLIERS[sup][0],
    custom: JSON.stringify({ "seed-col-brand": brand, "seed-col-shelf": shelf }),
  }));
  await prisma.product.createMany({ data: products });

  // 60 orders over the last 30 days; tax is 0, stock is not decremented (catalog already shows intended levels)
  const now = Date.now();
  const orders = [], items = [], sold = new Map();
  for (let n = 1; n <= 60; n++) {
    const id = `seed-ord-${String(n).padStart(4, "0")}`;
    const date = new Date(now - (n === 1 ? 0.2 : rnd() * 30) * DAY - rnd() * 3600000);
    date.setHours(8 + Math.floor(rnd() * 10), Math.floor(rnd() * 60));
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => pick(products));
    const merged = new Map();
    for (const p of lines) merged.set(p.id, { p, q: (merged.get(p.id)?.q || 0) + 1 + (rnd() < 0.2 ? 1 : 0) });
    const subtotal = [...merged.values()].reduce((t, { p, q }) => t + p.price * q, 0);
    const discountPercent = rnd() < 0.2 ? pick([5, 10]) : null;
    const discountAmount = discountPercent ? Math.round(subtotal * discountPercent) / 100 : null;
    const total = subtotal - (discountAmount || 0);
    const paymentMethod = pick(["CASH", "CASH", "CASH", "CARD", "MOBILE_WALLET"]);
    const status = n <= 3 ? "PENDING_SYNC" : n === 4 ? "FAILED" : "COMPLETED";
    const cashReceived = paymentMethod === "CASH" ? Math.ceil(total / 100) * 100 : null;
    orders.push({
      id, tenantId, status, subtotal, tax: 0, total, paymentMethod,
      isOffline: status === "PENDING_SYNC", date,
      syncedAt: status === "COMPLETED" ? date : null,
      cashierName: pick(CASHIERS), customerName: pick(CUSTOMERS),
      discountAmount, discountPercent, cashReceived,
      changeDue: cashReceived == null ? null : cashReceived - total,
    });
    let k = 0;
    for (const { p, q } of merged.values()) {
      items.push({ id: `seed-item-${n}-${++k}`, orderId: id, productId: p.id, name: p.name, price: p.price, quantity: q });
      if (status === "COMPLETED") sold.set(p.id, (sold.get(p.id) || 0) + q);
    }
  }
  await prisma.order.createMany({ data: orders });
  await prisma.orderItem.createMany({ data: items });

  // Stock ledger that adds up: opening + restocks + adjustments - sales = current stock.
  const movements = [];
  const orderById = new Map(orders.map((o) => [o.id, o]));
  for (const it of items) {
    const o = orderById.get(it.orderId);
    if (o.status !== "COMPLETED") continue;
    movements.push({ id: `seed-mov-sale-${it.id}`, tenantId, productId: it.productId, productName: it.name, type: "SALE", quantity: -it.quantity, unitCost: null, supplierId: null, note: "", date: o.date });
  }
  products.forEach((p, i) => {
    const restock = i % 3 === 0 ? 12 : 0;
    const adjust = i % 7 === 0 ? -1 : 0;
    const opening = p.stock + (sold.get(p.id) || 0) - restock - adjust;
    movements.push({ id: `seed-mov-open-${p.id}`, tenantId, productId: p.id, productName: p.name, type: "OPENING", quantity: opening, unitCost: p.costPrice, supplierId: p.supplierId, note: "Opening stock", date: new Date(now - 45 * DAY) });
    if (restock) movements.push({ id: `seed-mov-rs-${p.id}`, tenantId, productId: p.id, productName: p.name, type: "RESTOCK", quantity: restock, unitCost: p.costPrice, supplierId: p.supplierId, note: "", date: new Date(now - (5 + (i % 20)) * DAY) });
    if (adjust) movements.push({ id: `seed-mov-adj-${p.id}`, tenantId, productId: p.id, productName: p.name, type: "ADJUSTMENT", quantity: adjust, unitCost: null, supplierId: null, note: "Damaged: dropped in storage", date: new Date(now - (3 + (i % 10)) * DAY) });
  });
  await prisma.stockMovement.createMany({ data: movements });

  // Expenses: recurring bills for the last 3 months, plus the restocks as supplier purchases.
  const expenses = [];
  for (let m = 0; m < 3; m++) {
    EXPENSES.forEach(([category, description, base, times], i) => {
      for (let t = 0; t < Math.max(1, times); t++) {
        if (m === 0 && rnd() < 0.2) continue;
        const date = new Date(now - (m * 30 + 2 + Math.floor(rnd() * 26)) * DAY);
        if (date.getTime() > now) continue;
        expenses.push({
          id: `seed-exp-${m}-${i}-${t}`, tenantId, date, category, description,
          amount: Math.round(base * (0.9 + rnd() * 0.2)),
          paymentMethod: pick(["CASH", "CASH", "MOBILE_WALLET", "CARD"]),
          supplierId: null,
          custom: JSON.stringify({ "seed-col-ref": `R-${1000 + Math.floor(rnd() * 8999)}` }),
        });
      }
    });
  }
  movements.filter((mv) => mv.type === "RESTOCK").forEach((mv) =>
    expenses.push({
      id: `seed-exp-${mv.id}`, tenantId, date: mv.date, category: "Inventory",
      description: `Restock ${mv.quantity} × ${mv.productName}`, amount: mv.quantity * mv.unitCost,
      paymentMethod: "CASH", supplierId: mv.supplierId, custom: "{}",
    })
  );
  await prisma.expense.createMany({ data: expenses });

  console.log(
    `Seeded into "${tenant.name}" (${tenantId}): ${SUPPLIERS.length} suppliers, ${products.length} products, ` +
      `${orders.length} orders, ${items.length} order items, ${movements.length} stock movements, ${expenses.length} expenses, 4 custom columns.`
  );
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
