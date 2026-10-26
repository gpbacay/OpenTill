// npx tsx lib/void-sale.smoke.ts
import { countsTowardSales, voidDenial, voidReason } from "./void-sale";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok  -", msg);
};

const now = new Date(2026, 9, 26, 15, 0, 0);
const today = new Date(2026, 9, 26, 9, 0, 0).toISOString();
const yesterday = new Date(2026, 9, 25, 9, 0, 0).toISOString();
const cashier = { id: "c1", role: "CASHIER" };
const admin = { id: "a1", role: "ADMIN" };
const sale = { status: "COMPLETED", cashierId: "c1", date: today };

assert(voidDenial(cashier, sale, now) === null, "cashier voids their own sale from today");
assert(voidDenial(cashier, { ...sale, status: "PENDING_SYNC" }, now) === null, "a queued sale from today can be voided");
assert(voidDenial(cashier, { ...sale, date: yesterday }, now)?.status === 403, "cashier can't void yesterday's sale");
assert(voidDenial(cashier, { ...sale, cashierId: "c2" }, now)?.status === 403, "cashier can't void someone else's sale");
assert(voidDenial(cashier, { ...sale, cashierId: null }, now)?.status === 403, "cashier can't void a sale with no cashier");
assert(voidDenial(admin, { ...sale, date: yesterday, cashierId: null }, now) === null, "admin voids any sale, any day");
assert(voidDenial(admin, { ...sale, status: "VOIDED" }, now)?.status === 400, "a voided sale stays voided");
assert(voidDenial(admin, { ...sale, status: "FAILED" }, now)?.status === 400, "a sale that never saved can't be voided");

assert(countsTowardSales({ status: "COMPLETED" }) === true, "a saved sale counts");
assert(countsTowardSales({ status: "PENDING_SYNC" }) === true, "a queued sale counts");
assert(countsTowardSales({ status: "FAILED" }) === false, "a failed sale doesn't count");
assert(countsTowardSales({ status: "VOIDED" }) === false, "a voided sale drops out of the totals");

assert(voidReason("  rang the wrong item ") === "rang the wrong item", "reason is trimmed");
assert(voidReason("   ") === null, "an empty reason is refused");
assert(voidReason(null) === null, "a missing reason is refused");
assert(voidReason("x".repeat(250))?.length === 200, "reason is capped at 200 characters");
