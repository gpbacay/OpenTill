/** Field errors keyed by the input's id, so the first one can be focused and announced. */
export type FieldErrors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s().-]+$/;
const USERNAME = /^[a-z0-9._-]{3,32}$/;

/** What a number field keeps as you type: digits, one "." (if `decimals`) and a leading "-" (if `negative`). */
export function numericInput(value: string, { decimals = true, negative = false }: { decimals?: boolean; negative?: boolean } = {}) {
  let out = "";
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && decimals && !out.includes(".")) out += ch;
    else if (ch === "-" && negative && out === "") out += ch;
  }
  return out;
}

export const required = (value: string, message: string) => (value.trim() ? undefined : message);

export const maxLength = (value: string, max: number, label: string) =>
  value.trim().length > max ? `${label} must be ${max} characters or fewer.` : undefined;

/** A typed number. Empty passes unless `required`; then range and whole-number checks. */
export function numberError(
  value: string,
  label: string,
  { required: needed = false, min, max, integer = false, positive = false }: { required?: boolean; min?: number; max?: number; integer?: boolean; positive?: boolean } = {}
) {
  if (!value.trim()) return needed ? `Enter ${label}.` : undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${capitalize(label)} must be a number.`;
  if (integer && !Number.isInteger(n)) return `${capitalize(label)} must be a whole number.`;
  if (positive && n <= 0) return `${capitalize(label)} must be more than 0.`;
  if (min !== undefined && n < min) return `${capitalize(label)} can't be less than ${min}.`;
  if (max !== undefined && n > max) return `${capitalize(label)} can't be more than ${max}.`;
  return undefined;
}

export const emailError = (value: string) => (value.trim() && !EMAIL.test(value.trim()) ? "Enter a valid email, like name@shop.com." : undefined);

export const phoneError = (value: string) => {
  const v = value.trim();
  if (!v) return undefined;
  const digits = v.replace(/\D/g, "").length;
  return PHONE.test(v) && digits >= 7 && digits <= 15 ? undefined : "Enter a valid phone number, like 0917 123 4567.";
};

/** New usernames: 3–32 lowercase letters, numbers, dots, dashes or underscores. */
export const usernameError = (value: string) =>
  !value.trim()
    ? "Enter a username."
    : USERNAME.test(value.trim().toLowerCase())
      ? undefined
      : "Use 3–32 letters, numbers, dots, dashes or underscores, with no spaces.";

export const passwordError = (value: string) => (value.length < 8 ? "Password must be at least 8 characters." : undefined);

/** Drop the passing checks: { "p-name": "Enter a name.", "p-sku": undefined } → { "p-name": "Enter a name." }. */
export function collect(checks: Record<string, string | undefined>): FieldErrors {
  return Object.fromEntries(Object.entries(checks).filter(([, message]) => message)) as FieldErrors;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
