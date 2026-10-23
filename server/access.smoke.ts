// Access-control smoke test (stores, cashiers, cashier limits). Run against a throwaway database:
//   DATABASE_URL=file:/tmp/smoke.db npx prisma migrate deploy && DATABASE_URL=file:/tmp/smoke.db npx tsx server/access.smoke.ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import express from "express";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok  -", msg);
};

async function main() {
  const { AppModule } = await import("./app.module");
  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  app.getHttpAdapter().getInstance().use(express.json());
  await app.listen(3999);
  const base = "http://localhost:3999";

  const call = async (cookie: string, method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", cookie },
      body: body && method !== "GET" ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, res };
  };
  const signup = async (username: string) => {
    const r = await call("", "POST", "/api/auth/register", { username, password: "password123" });
    return (r.res.headers.get("set-cookie") ?? "").split(";")[0];
  };

  const admin = await signup("boss");
  const other = await signup("rival");

  // stores: create, edit, list
  let r = await call(admin, "PUT", "/api/tenants/t1", { name: "Main", businessType: "Retail", taxRate: 0.12, currency: "PHP" });
  assert(r.status === 200 && r.json.name === "Main", "admin creates store t1");
  r = await call(admin, "PUT", "/api/tenants/t2", { name: "Branch", taxRate: 5 });
  assert(r.json.taxRate === 1, "tax rate clamped to 1");
  r = await call(admin, "PUT", "/api/tenants/t2", { name: "Branch 2", taxRate: 0.05, businessType: "Grocery", currency: "USD" });
  assert(r.json.name === "Branch 2" && r.json.currency === "USD", "admin edits store t2");
  r = await call(admin, "GET", "/api/tenants");
  assert(r.json.length === 2, "admin lists 2 stores");
  r = await call(other, "PUT", "/api/tenants/t1", { name: "Hijack" });
  assert(r.status === 403, "other admin can't overwrite t1");
  r = await call(other, "DELETE", "/api/tenants/t1");
  assert(r.status === 403, "other admin can't delete t1");
  r = await call(admin, "PUT", "/api/tenants/t3", { name: "   " });
  assert(r.status === 400, "blank store name rejected");

  // products for t1
  r = await call(admin, "POST", "/api/products", { id: "p1", tenantId: "t1", name: "Cola", category: "Drinks", sku: "C1", price: 10, stock: 5, description: "" });
  assert(r.status === 201 || r.status === 200, "admin adds product");

  // cashiers
  r = await call(admin, "POST", "/api/cashiers", { name: "Cathy", username: "cathy", password: "short", tenantId: "t1" });
  assert(r.status === 400, "short cashier password rejected");
  r = await call(admin, "POST", "/api/cashiers", { name: "Cathy", username: "cathy", password: "cashier123", tenantId: "t1" });
  assert(r.status === 201 && r.json.tenantId === "t1", "admin creates cashier");
  const cid = r.json.id;
  r = await call(admin, "POST", "/api/cashiers", { name: "Dup", username: "cathy", password: "cashier123", tenantId: "t1" });
  assert(r.status === 409, "duplicate username rejected");
  r = await call(other, "POST", "/api/cashiers", { name: "X", username: "x1234", password: "cashier123", tenantId: "t1" });
  assert(r.status === 403, "other admin can't add cashier to my store");
  r = await call(other, "DELETE", "/api/cashiers/" + cid);
  assert(r.status === 404, "other admin can't delete my cashier");

  r = await call("", "POST", "/api/auth/login", { username: "cathy", password: "cashier123" });
  const cashier = (r.res.headers.get("set-cookie") ?? "").split(";")[0];
  assert(r.json.role === "CASHIER" && r.json.tenantId === "t1", "cashier logs in with role + store");

  r = await call(cashier, "GET", "/api/tenants");
  assert(r.json.length === 1 && r.json[0].id === "t1", "cashier sees only their store");
  r = await call(cashier, "GET", "/api/products");
  assert(r.status === 200 && r.json.length === 1, "cashier reads products");
  const order = { id: "o1", tenantId: "t1", status: "COMPLETED", subtotal: 10, tax: 0, total: 10, paymentMethod: "CASH", isOffline: false, date: new Date().toISOString(), cashierName: "Cathy" };
  r = await call(cashier, "POST", "/api/orders/sync", { orders: [order], items: [{ id: "i1", orderId: "o1", productId: "p1", name: "Cola", price: 10, quantity: 1 }] });
  assert(r.status === 201 || r.status === 200, "cashier rings a sale");
  r = await call(admin, "GET", "/api/orders");
  assert(r.json.length === 1 && r.json[0].cashierName === "Cathy", "admin sees the cashier's order");
  for (const [m, p] of [["GET", "/api/orders"], ["GET", "/api/cashiers"], ["POST", "/api/cashiers"], ["PUT", "/api/tenants/t1"], ["DELETE", "/api/tenants/t1"], ["PUT", "/api/products/p1"], ["DELETE", "/api/products/p1"], ["GET", "/api/suppliers"], ["GET", "/api/expenses"], ["PUT", "/api/suppliers/s1"], ["GET", "/api/stock-movements"]] as const) {
    r = await call(cashier, m, p, {});
    assert(r.status === 403, `cashier blocked: ${m} ${p}`);
  }
  r = await call(cashier, "GET", "/api/tenants?x=1");
  assert(r.status === 200, "query string doesn't break allowlist");
  r = await call(cashier, "PATCH", "/api/auth/account", { name: "Cathy B", username: "cathy" });
  assert(r.status === 200 && r.json.role === "CASHIER", "cashier edits own account");
  r = await call(cashier, "POST", "/api/orders/sync", { orders: [{ ...order, id: "o2", tenantId: "t2" }], items: [] });
  assert(r.status === 403, "cashier can't sell into another store");

  // update cashier: move store, reset password → old session dies
  r = await call(admin, "PATCH", "/api/cashiers/" + cid, { tenantId: "t2", password: "newpassword1" });
  assert(r.status === 200 && r.json.tenantId === "t2", "admin moves cashier + resets password");
  r = await call(cashier, "GET", "/api/auth/me");
  assert(r.status === 401, "password reset signs the cashier out");
  r = await call("", "POST", "/api/auth/login", { username: "cathy", password: "newpassword1" });
  assert(r.status === 200, "cashier logs in with new password");
  const cashier2 = (r.res.headers.get("set-cookie") ?? "").split(";")[0];

  // delete store t2 → cashier gone; delete t1 wipes products/orders
  r = await call(admin, "DELETE", "/api/tenants/t2");
  assert(r.status === 200, "admin deletes store t2");
  r = await call(cashier2, "GET", "/api/auth/me");
  assert(r.status === 401, "cashier of deleted store is signed out");
  r = await call("", "POST", "/api/auth/login", { username: "cathy", password: "newpassword1" });
  assert(r.status === 401, "cashier account removed with its store");
  r = await call(admin, "GET", "/api/cashiers");
  assert(r.json.length === 0, "cashier list empty");
  r = await call(admin, "DELETE", "/api/tenants/t1");
  assert(r.status === 200, "admin deletes store t1 (with sales)");
  r = await call(admin, "GET", "/api/orders");
  assert(r.json.length === 0, "orders gone");
  r = await call(admin, "GET", "/api/tenants");
  assert(r.json.length === 0, "no stores left");
  r = await call(admin, "DELETE", "/api/tenants/t1");
  assert(r.status === 404, "deleting twice is 404");

  await app.close();
  console.log("ALL PASSED");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
