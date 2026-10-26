// npx tsx lib/scan.smoke.ts
import { productIdFromScan } from "./scan";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok  -", msg);
};

assert(productIdFromScan("https://shop.example/inventory/product/prod-001") === "prod-001", "absolute product URL");
assert(productIdFromScan("https://shop.example/inventory/product/prod-001/") === "prod-001", "trailing slash");
assert(productIdFromScan("/inventory/product/prod-001?print=1") === "prod-001", "relative path with query");
assert(productIdFromScan("https://shop.example/inventory/product/prod%2F1") === "prod/1", "encoded id");
assert(productIdFromScan("  https://shop.example/inventory/product/prod-001  ") === "prod-001", "trims whitespace");
assert(productIdFromScan("SKU-1") === null, "a SKU is not a product QR");
assert(productIdFromScan("https://shop.example/inventory") === null, "other pages are ignored");
assert(productIdFromScan("") === null, "empty scan");
