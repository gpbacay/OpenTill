const PRODUCT_PATH = /\/inventory\/product\/([^/?#]+)\/?$/;

/** Product id printed into an inventory QR, which is the product page URL. */
export function productIdFromScan(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let path = text;
  try {
    path = new URL(text).pathname;
  } catch {
    if (!text.startsWith("/")) return null;
    path = text.split(/[?#]/)[0];
  }
  const match = path.match(PRODUCT_PATH);
  if (!match?.[1]) return null;
  try {
    const id = decodeURIComponent(match[1]);
    return id || null;
  } catch {
    return match[1];
  }
}
