// No 0/O or 1/I: codes get read aloud and typed at the register.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A short code for a new product, like SNA-7K3Q: the category's first letters plus random characters, unique among `taken` (upper case). */
export function generateSku(category: string, taken: Set<string>) {
  const prefix = (category.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "PRD").padEnd(3, "X");
  for (let length = 4; ; length += 1) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = [...crypto.getRandomValues(new Uint8Array(length))].map((n) => ALPHABET[n % ALPHABET.length]).join("");
      if (!taken.has(`${prefix}-${code}`)) return `${prefix}-${code}`;
    }
  }
}
