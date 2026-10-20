/** Custom column values are a flat {columnId: string} map, stored as JSON text. */
export function parseCustom(raw: unknown): Record<string, string> {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
        .map(([k, v]) => [k, String(v).slice(0, 200)])
    );
  } catch {
    return {};
  }
}

export const encodeCustom = (custom: unknown) => JSON.stringify(parseCustom(custom));
