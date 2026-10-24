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
  assert(!("costPrice" in r.json[0]) && !("supplierId" in r.json[0]), "cashier doesn't see cost price or supplier");

  // categories: per store, renaming one renames it on the store's products
  r = await call(admin, "PUT", "/api/categories/c1", { tenantId: "t1", name: "  Drinks  " });
  assert(r.status === 200 && r.json.name === "Drinks", "admin adds a category (trimmed)");
  r = await call(other, "PUT", "/api/categories/c2", { tenantId: "t1", name: "Sneaky" });
  assert(r.status === 403, "other admin can't add categories to my store");
  r = await call(other, "GET", "/api/categories");
  assert(r.json.length === 0, "other admin doesn't see my categories");
  r = await call(cashier, "GET", "/api/categories");
  assert(r.status === 403, "cashier can't use the categories API");
  r = await call(admin, "PUT", "/api/categories/c1", { tenantId: "t1", name: "Beverages" });
  assert(r.status === 200 && r.json.name === "Beverages", "admin renames the category");
  r = await call(admin, "GET", "/api/products");
  assert(r.json.find((x: any) => x.id === "p1").category === "Beverages", "the rename reached the products in that category");
  r = await call(admin, "PUT", "/api/categories/c3", { tenantId: "t1", name: "x".repeat(80) });
  assert(r.json.name.length === 40, "category names are capped at 40 characters");
  r = await call(admin, "DELETE", "/api/categories/c3");
  assert(r.status === 200, "admin deletes a category");
  r = await call(admin, "GET", "/api/products");
  assert(r.json.find((x: any) => x.id === "p1").category === "Beverages", "deleting a category leaves products as they were");
  r = await call(admin, "PUT", "/api/categories/c1", { tenantId: "t1", name: "Drinks" });
  r = await call(admin, "GET", "/api/products");
  assert(r.json.find((x: any) => x.id === "p1").category === "Drinks", "renamed back, products follow");

  // SKU is optional and editable
  r = await call(admin, "POST", "/api/products", { id: "p2", tenantId: "t1", name: "Loose item", category: "Misc", price: 5, description: "" });
  assert((r.status === 201 || r.status === 200) && r.json.sku === "", "a product can be added without a SKU");
  r = await call(admin, "POST", "/api/products", { id: "p3", tenantId: "t1", name: "Another loose item", category: "Misc", sku: "", price: 6, description: "" });
  assert(r.json.sku === "", "two products can both have no SKU");
  r = await call(admin, "PUT", "/api/products/p2", { id: "p2", tenantId: "t1", name: "Loose item", category: "Misc", sku: "  LOOSE-1 ", price: 5, description: "" });
  assert(r.status === 200 && r.json.sku === "LOOSE-1", "adding a SKU later is saved");
  r = await call(admin, "PUT", "/api/products/p2", { id: "p2", tenantId: "t1", name: "Loose item", category: "Misc", sku: "", price: 5, description: "" });
  assert(r.status === 200 && r.json.sku === "", "clearing a SKU is saved");
  await call(admin, "DELETE", "/api/products/p2");
  await call(admin, "DELETE", "/api/products/p3");

  // change counters: what the cashier's browser polls when there is no live stream
  const versionsOf = async (cookie: string) => (await call(cookie, "GET", "/api/changes")).json as Record<string, number>;
  const until = async (cookie: string, key: string, above: number) => {
    for (let i = 0; i < 40; i++) {
      const v = await versionsOf(cookie);
      if ((v[key] ?? 0) > above) return v[key];
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return -1;
  };
  const before = (await versionsOf(admin))["t1:products"] ?? 0;
  assert(before >= 1, "admin's product add is counted in /api/changes");
  assert((await versionsOf(cashier))["t1:products"] === before, "cashier sees the same counter for their store");
  r = await call(admin, "PUT", "/api/products/p1", { id: "p1", tenantId: "t1", name: "Cola", category: "Drinks", sku: "C1", price: 12, stock: 5, description: "" });
  assert(r.status === 200, "admin edits the product");
  assert((await until(cashier, "t1:products", before)) > before, "the cashier's counter moves after the admin's edit");
  assert(Object.keys(await versionsOf(other)).length === 0, "another admin sees none of this store's changes");
  r = await call(admin, "PUT", "/api/tenants/t1", { name: "Main", businessType: "Retail", taxRate: 0.1, currency: "PHP" });
  assert((await until(cashier, "t1:tenants", 0)) >= 1, "a store change (tax rate) reaches the cashier's counter too");
  r = await call("", "GET", "/api/changes");
  assert(r.status === 401, "counters need a sign-in");
  const order = { id: "o1", tenantId: "t1", status: "COMPLETED", subtotal: 10, tax: 0, total: 10, paymentMethod: "CASH", isOffline: false, date: new Date().toISOString(), cashierName: "Cathy" };
  r = await call(cashier, "POST", "/api/orders/sync", { orders: [order], items: [{ id: "i1", orderId: "o1", productId: "p1", name: "Cola", price: 10, quantity: 1 }] });
  assert(r.status === 201 || r.status === 200, "cashier rings a sale");
  r = await call(admin, "GET", "/api/orders");
  assert(r.json.length === 1 && r.json[0].cashierName === "Cathy", "admin sees the cashier's order");
  r = await call(admin, "POST", "/api/orders/sync", { orders: [{ ...order, id: "o-admin", cashierName: "Cathy" }], items: [] });
  assert(r.status === 201 || r.status === 200, "admin rings a sale (even under the cashier's name)");
  r = await call(cashier, "GET", "/api/orders");
  assert(r.status === 200 && r.json.length === 1 && r.json[0].id === "o1", "cashier sees only the sales they rang up");
  r = await call(admin, "GET", "/api/orders");
  assert(r.json.length === 2, "admin sees every sale");
  r = await call(admin, "GET", "/api/cashiers");
  assert(
    r.json[0].pages.join() === "/,/records,/reports,/activity",
    "cashier starts with the sales pages; Inventory and Expenses start off"
  );
  assert(r.json[0].lastSeenAt !== null, "the cashier's requests mark them as recently active");
  assert(((await versionsOf(admin))["t1:cashiers"] ?? 0) >= 1, "cashier activity reaches the admin's change counter");
  r = await call(admin, "PATCH", "/api/cashiers/" + cid, { pages: ["/settings"] });
  assert(r.status === 400, "admin can't give a cashier a back-office page");
  r = await call(admin, "PATCH", "/api/cashiers/" + cid, { pages: ["/help"] });
  assert(r.status === 400, "Help center is always on, so it isn't a page to toggle");
  r = await call(admin, "PATCH", "/api/cashiers/" + cid, { pages: [] });
  assert(r.status === 200 && r.json.pages.length === 0, "admin turns off the cashier's sales pages");
  r = await call(cashier, "GET", "/api/auth/me");
  assert(r.json.pages.length === 0, "the cashier's session carries their pages");
  r = await call(cashier, "GET", "/api/orders");
  assert(r.status === 403, "no sales pages, no sales data");
  r = await call(admin, "PATCH", "/api/cashiers/" + cid, { pages: ["/", "/records"] });
  r = await call(cashier, "GET", "/api/orders");
  assert(r.status === 200, "turning a sales page back on restores it");
  for (const [m, p] of [["GET", "/api/suppliers"], ["GET", "/api/expenses"], ["GET", "/api/stock-movements"], ["GET", "/api/columns"], ["GET", "/api/cashiers"], ["POST", "/api/cashiers"], ["PUT", "/api/tenants/t1"], ["DELETE", "/api/tenants/t1"], ["PUT", "/api/products/p1"], ["DELETE", "/api/products/p1"], ["PUT", "/api/expenses/e1"], ["PUT", "/api/suppliers/s1"], ["PUT", "/api/stock-movements/m1"], ["PUT", "/api/columns/x1"]] as const) {
    r = await call(cashier, m, p, {});
    assert(r.status === 403, `cashier blocked: ${m} ${p}`);
  }

  // Inventory and Expenses open their own endpoints, scoped to the cashier's store
  r = await call(admin, "PATCH", "/api/cashiers/" + cid, { pages: ["/", "/records", "/inventory"] });
  assert(r.status === 200 && r.json.pages.includes("/inventory"), "admin gives the cashier Inventory");
  r = await call(cashier, "GET", "/api/products");
  assert("costPrice" in r.json[0], "with Inventory the cashier sees cost prices");
  r = await call(cashier, "PUT", "/api/products/p1", { id: "p1", tenantId: "t1", name: "Cola", category: "Drinks", sku: "C1", price: 13, description: "" });
  assert(r.status === 200 && r.json.price === 13, "with Inventory the cashier edits a product");
  r = await call(cashier, "PUT", "/api/stock-movements/m-cashier", { tenantId: "t1", productId: "p1", type: "ADJUSTMENT", quantity: 2, date: new Date().toISOString() });
  assert(r.status === 200, "with Inventory the cashier adjusts stock");
  for (const p of ["/api/stock-movements", "/api/suppliers", "/api/categories", "/api/columns"]) {
    r = await call(cashier, "GET", p);
    assert(r.status === 200, `with Inventory the cashier reads ${p}`);
  }
  r = await call(cashier, "POST", "/api/products", { id: "p-other", tenantId: "t2", name: "Sneaky", price: 1, description: "" });
  assert(r.status === 403, "with Inventory the cashier still can't add products to another store");
  for (const [m, p] of [["PUT", "/api/suppliers/s1"], ["PUT", "/api/categories/c9"], ["PUT", "/api/columns/x1"], ["GET", "/api/expenses"], ["PUT", "/api/expenses/e1"]] as const) {
    r = await call(cashier, m, p, { tenantId: "t1", name: "x" });
    assert(r.status === 403, `Inventory alone still blocks ${m} ${p}`);
  }
  r = await call(admin, "PATCH", "/api/cashiers/" + cid, { pages: ["/", "/records", "/expenses"] });
  r = await call(cashier, "PUT", "/api/expenses/e-cashier", { tenantId: "t1", category: "Supplies", description: "Bags", amount: 50, paymentMethod: "CASH", date: new Date().toISOString() });
  assert(r.status === 200 && r.json.amount === 50, "with Expenses the cashier records an expense");
  r = await call(cashier, "GET", "/api/expenses");
  assert(r.status === 200 && r.json.some((e: any) => e.id === "e-cashier"), "with Expenses the cashier reads expenses");
  r = await call(cashier, "PUT", "/api/expenses/e-other", { tenantId: "t2", category: "Supplies", amount: 5, paymentMethod: "CASH" });
  assert(r.status === 403, "with Expenses the cashier still can't spend in another store");
  r = await call(cashier, "DELETE", "/api/expenses/e-cashier");
  assert(r.status === 200, "with Expenses the cashier deletes an expense");
  r = await call(cashier, "PUT", "/api/products/p1", { id: "p1", tenantId: "t1", name: "Cola", price: 12 });
  assert(r.status === 403, "turning Inventory off closes product edits again");
  r = await call(admin, "PATCH", "/api/cashiers/" + cid, { pages: ["/", "/records"] });

  r = await call(cashier, "GET", "/api/tenants?x=1");
  assert(r.status === 200, "query string doesn't break allowlist");
  r = await call(cashier, "PATCH", "/api/auth/account", { name: "Cathy B", username: "cathy" });
  assert(r.status === 200 && r.json.role === "CASHIER", "cashier edits own account");
  r = await call(cashier, "POST", "/api/orders/sync", { orders: [{ ...order, id: "o2", tenantId: "t2" }], items: [] });
  assert(r.status === 403, "cashier can't sell into another store");

  // sign-in links: the admin sets the password; a link signs in up to N devices (no expiry)
  const cookiesOf = (res: Response) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const deviceOf = (res: Response) => cookiesOf(res).split("; ").find((c) => c.startsWith("opentill_device=")) ?? "";
  const list = async () => (await call(admin, "GET", "/api/cashiers")).json as any[];

  r = await call(admin, "POST", "/api/cashiers", { username: "ivy", tenantId: "t1" });
  assert(r.status === 400, "admin must set a cashier password (no password -> rejected)");
  for (const bad of [0, 1.5, 21, "2"]) {
    r = await call(admin, "POST", "/api/cashiers", { username: "ivy", password: "ivypass123", tenantId: "t1", maxUses: bad });
    assert(r.status === 400, `link device limit ${JSON.stringify(bad)} rejected`);
  }
  r = await call(admin, "POST", "/api/cashiers", { username: "ivy", password: "ivypass123", tenantId: "t1", maxUses: 2 });
  assert(r.status === 201 && typeof r.json.inviteToken === "string" && r.json.hasLink && r.json.linkUses === 0 && r.json.linkMaxUses === 2, "cashier created with a 2-device link");
  const ivy = r.json;
  assert(!("passwordHash" in r.json) && !("inviteExpires" in r.json), "no hash leaked, no expiry");
  r = await call("", "GET", "/api/auth/invite/" + ivy.inviteToken);
  assert(r.status === 200 && r.json.username === "ivy" && r.json.store === "Main", "link info is public and names the store");
  r = await call("", "GET", "/api/auth/invite/not-a-real-token");
  assert(r.status === 404, "unknown link token is 404");

  r = await call("", "POST", "/api/auth/join", { token: ivy.inviteToken });
  const phoneA = deviceOf(r.res);
  const ivyCookie = (r.res.headers.get("set-cookie") ?? "").split(";")[0];
  assert(r.status === 200 && r.json.role === "CASHIER" && r.json.tenantId === "t1" && phoneA && ivyCookie.includes("opentill_session"), "device A: link signs in and records the device");
  r = await call(ivyCookie, "GET", "/api/tenants");
  assert(r.status === 200 && r.json.length === 1, "linked cashier can use the register");
  r = await call(ivyCookie, "GET", "/api/cashiers");
  assert(r.status === 403, "linked cashier is still limited");
  assert((await list()).find((c) => c.id === ivy.id).linkUses === 1, "usage shows 1 of 2");
  r = await call(phoneA, "POST", "/api/auth/join", { token: ivy.inviteToken });
  assert(r.status === 200, "device A can use the link again after logging out");
  assert((await list()).find((c) => c.id === ivy.id).linkUses === 1, "re-using on the same device doesn't count again");
  r = await call("", "POST", "/api/auth/join", { token: ivy.inviteToken });
  const phoneB = deviceOf(r.res);
  assert(r.status === 200 && phoneB && phoneB !== phoneA, "device B: second device is allowed");
  r = await call("", "POST", "/api/auth/join", { token: ivy.inviteToken });
  assert(r.status === 403 && /already used/.test(r.json.message), "device C: refused, the 2 allowed devices are taken");
  r = await call("", "GET", "/api/auth/invite/" + ivy.inviteToken);
  assert(r.status === 403, "device C: link page says it's used up");
  r = await call(phoneB, "POST", "/api/auth/join", { token: ivy.inviteToken });
  assert(r.status === 200, "a recorded device still works when the link is full");
  r = await call("", "POST", "/api/auth/login", { username: "ivy", password: "ivypass123" });
  assert(r.status === 200, "the admin's password works from any device (not device-locked)");

  // admin: reset usage
  r = await call(other, "POST", `/api/cashiers/${ivy.id}/reset-link`);
  assert(r.status === 404, "other admin can't reset my cashier's link");
  r = await call(ivyCookie, "POST", `/api/cashiers/${ivy.id}/reset-link`);
  assert(r.status === 403, "cashier can't reset links");
  r = await call(admin, "POST", `/api/cashiers/${ivy.id}/reset-link`);
  assert(r.status === 201 || r.status === 200, "admin resets the link's usage");
  assert(r.json.linkUses === 0 && r.json.hasLink && !("inviteToken" in r.json), "usage back to 0, same link, no token re-shown");
  r = await call(ivyCookie, "GET", "/api/auth/me");
  assert(r.status === 401, "reset signs the cashier out everywhere");
  r = await call("", "POST", "/api/auth/join", { token: ivy.inviteToken });
  assert(r.status === 200, "the same link works again after the reset (device C gets in)");

  // someone used the link before the real cashier -> reset -> cashier gets in, intruder is locked out
  r = await call(admin, "POST", "/api/cashiers", { username: "jo", password: "jopass1234", tenantId: "t1" });
  const jo = r.json;
  assert(jo.linkMaxUses === 1, "device limit defaults to 1");
  r = await call("", "POST", "/api/auth/join", { token: jo.inviteToken });
  const intruder = deviceOf(r.res);
  const intruderSession = (r.res.headers.get("set-cookie") ?? "").split(";")[0];
  assert(r.status === 200, "intruder opens jo's link first");
  r = await call("", "POST", "/api/auth/join", { token: jo.inviteToken });
  assert(r.status === 403, "the real cashier is now locked out");
  await call(admin, "POST", `/api/cashiers/${jo.id}/reset-link`);
  r = await call(intruderSession, "GET", "/api/auth/me");
  assert(r.status === 401, "the intruder's session is gone after the reset");
  r = await call("", "POST", "/api/auth/join", { token: jo.inviteToken });
  assert(r.status === 200, "the real cashier takes the single slot");
  r = await call(intruder, "POST", "/api/auth/join", { token: jo.inviteToken });
  assert(r.status === 403, "the intruder can't get back in with the link");

  // admin: new link and limit changes
  r = await call(admin, "POST", `/api/cashiers/${jo.id}/invite`);
  const joNew = r.json;
  assert(joNew.inviteToken && joNew.inviteToken !== jo.inviteToken && joNew.linkUses === 0, "admin makes a brand-new link, usage zero");
  r = await call("", "POST", "/api/auth/join", { token: jo.inviteToken });
  assert(r.status === 404, "the old link is dead");
  r = await call(admin, "PATCH", "/api/cashiers/" + jo.id, { maxUses: 3 });
  assert(r.status === 200 && r.json.linkMaxUses === 3, "admin raises the device limit");
  r = await call(admin, "PATCH", "/api/cashiers/" + jo.id, { maxUses: 0 });
  assert(r.status === 400, "invalid limit rejected on edit");

  // admin changes a cashier's password; the link is separate
  r = await call(admin, "PATCH", "/api/cashiers/" + jo.id, { password: "newjopass123" });
  assert(r.status === 400, "changing a cashier's password needs their current password");
  r = await call(admin, "PATCH", "/api/cashiers/" + jo.id, { password: "newjopass123", currentPassword: "wrong-password" });
  assert(r.status === 400 && /current password is incorrect/.test(r.json.message), "wrong current password is rejected");
  r = await call("", "POST", "/api/auth/login", { username: "jo", password: "jopass1234" });
  assert(r.status === 200, "password unchanged after the rejected attempts");
  r = await call(admin, "PATCH", "/api/cashiers/" + jo.id, { password: "newjopass123", currentPassword: "jopass1234" });
  assert(r.status === 200, "admin changes a cashier's password with the right current one");
  r = await call("", "POST", "/api/auth/login", { username: "jo", password: "jopass1234" });
  assert(r.status === 401, "old password no longer works");
  r = await call("", "POST", "/api/auth/login", { username: "jo", password: "newjopass123" });
  assert(r.status === 200, "new admin-set password works");
  r = await call("", "POST", "/api/auth/join", { token: joNew.inviteToken });
  assert(r.status === 200, "the link is unaffected by a password change");
  r = await call(admin, "POST", "/api/cashiers", { username: "kim", password: "short", tenantId: "t1" });
  assert(r.status === 400, "a too-short admin password is rejected");
  assert(!JSON.stringify(await list()).includes("inviteToken") && !JSON.stringify(await list()).includes("inviteHash"), "list never exposes tokens");

  // cashiers can't change their own username or password
  r = await call(ivyCookie, "PATCH", "/api/auth/account", { name: "Ivy", username: "ivy", currentPassword: "ivypass123", newPassword: "mynewpass123" });
  assert(r.status === 401 || r.status === 403, "cashier can't change their password");
  r = await call("", "POST", "/api/auth/login", { username: "ivy", password: "ivypass123" });
  const ivyLogin = (r.res.headers.get("set-cookie") ?? "").split(";")[0];
  r = await call(ivyLogin, "PATCH", "/api/auth/account", { name: "Ivy", username: "ivy", currentPassword: "ivypass123", newPassword: "mynewpass123" });
  assert(r.status === 403, "signed-in cashier can't change their password");
  r = await call(ivyLogin, "PATCH", "/api/auth/account", { name: "Ivy", username: "ivy2", currentPassword: "ivypass123" });
  assert(r.status === 403, "cashier can't change their username");
  r = await call(ivyLogin, "PATCH", "/api/auth/account", { name: "Ivy B", username: "ivy" });
  assert(r.status === 200 && r.json.name === "Ivy B", "cashier can still change their display name");
  r = await call("", "POST", "/api/auth/login", { username: "ivy", password: "ivypass123" });
  assert(r.status === 200, "password unchanged after the blocked attempts");

  // update cashier: move store, reset password → old session dies
  r = await call(admin, "PATCH", "/api/cashiers/" + cid, { tenantId: "t2", password: "newpassword1", currentPassword: "cashier123" });
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
  assert(r.json.every((c: any) => c.tenantId === "t1") && !r.json.some((c: any) => c.username === "cathy"), "cashier list drops the deleted store's cashier");
  r = await call(admin, "DELETE", "/api/tenants/t1");
  assert(r.status === 200, "admin deletes store t1 (with sales)");
  r = await call(admin, "GET", "/api/cashiers");
  assert(r.json.length === 0, "cashier list empty");
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
