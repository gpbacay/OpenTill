import { toDateInput } from "./periods";

/** ponytail: "today" is this machine's calendar. Add a store timezone if the API isn't at the shop. */
export const VOID_REASON_MAX = 200;

export interface VoidDenial {
  status: 400 | 403;
  message: string;
}

/** A sale still in the totals. Voided and failed sales stay on the list but drop out. */
export const countsTowardSales = (order: { status: string }) => order.status !== "FAILED" && order.status !== "VOIDED";

/**
 * Who may void a sale. A cashier: only their own, and only on the day it was rung up.
 * An admin: any sale in a store they own (the store check stays with the API).
 */
export function voidDenial(
  user: { id: string; role?: string | null },
  order: { status: string; cashierId?: string | null; date: string },
  now = new Date()
): VoidDenial | null {
  if (order.status === "VOIDED") return { status: 400, message: "This sale is already voided." };
  if (order.status === "FAILED") return { status: 400, message: "This sale never saved." };
  if (user.role === "CASHIER") {
    if (order.cashierId !== user.id) return { status: 403, message: "You can only void a sale you rang up." };
    if (toDateInput(order.date) !== toDateInput(now.toISOString())) {
      return { status: 403, message: "You can only void a sale from today." };
    }
  }
  return null;
}

/** Trimmed reason, or null when there is nothing to keep. Longer text is cut at 200. */
export function voidReason(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!text) return null;
  return text.slice(0, VOID_REASON_MAX);
}
