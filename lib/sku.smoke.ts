// npx tsx lib/sku.smoke.ts
import { generateSku } from "./sku";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok  -", msg);
};

assert(/^SNA-[A-HJKMNP-Z2-9]{4}$/.test(generateSku("Snacks", new Set())), "category prefix + 4 readable characters");
assert(generateSku("", new Set()).startsWith("PRD-"), "no category letters -> PRD");
assert(generateSku("A1", new Set()).startsWith("AXX-"), "short category is padded");
assert(generateSku("Motorcycle Parts", new Set()).startsWith("MOT-"), "uses the first three letters");
const taken = new Set<string>();
for (let i = 0; i < 2000; i += 1) {
  const sku = generateSku("Snacks", taken);
  if (taken.has(sku)) throw new Error("FAIL: repeated " + sku);
  taken.add(sku);
}
