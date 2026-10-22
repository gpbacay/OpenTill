import type { FieldErrors } from "@/lib/validation";

/** Message under a field. Pair with `invalid(errors, id)` on the input so screen readers read it too. */
export function FieldError({ errors, id }: { errors: FieldErrors; id: string }) {
  return errors[id] ? (
    <p id={`${id}-error`} className="text-xs text-destructive">
      {errors[id]}
    </p>
  ) : null;
}

/** aria props that turn an input red and link it to its FieldError. */
export const invalid = (errors: FieldErrors, id: string) =>
  errors[id] ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};

/** Show errors and move focus to the first broken field. Returns true when the form may be saved. */
export function check(errors: FieldErrors, setErrors: (errors: FieldErrors) => void) {
  setErrors(errors);
  const first = Object.keys(errors)[0];
  if (!first) return true;
  requestAnimationFrame(() => document.getElementById(first)?.focus());
  return false;
}

/** Clear one field's error as soon as it's edited. */
export const clearError = (setErrors: (update: (prev: FieldErrors) => FieldErrors) => void, id: string) =>
  setErrors((prev) => {
    if (!prev[id]) return prev;
    const next = { ...prev };
    delete next[id];
    return next;
  });
