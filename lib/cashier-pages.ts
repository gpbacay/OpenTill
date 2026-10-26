// Shared by the app and the API (server/), so keep it free of browser or Node-only imports.

/**
 * Pages an admin can turn on or off for each cashier. `optIn` pages start off.
 * Inventory starts on. Account, Help center and About are always on.
 */
export const CASHIER_PAGES = [
  { href: "/orders", label: "Register" },
  { href: "/", label: "Dashboard" },
  { href: "/records", label: "Sales" },
  { href: "/reports", label: "Reports" },
  { href: "/activity", label: "Recent activity" },
  { href: "/inventory", label: "Inventory" },
  { href: "/expenses", label: "Expenses", optIn: true },
] as const;

export const ALWAYS_OPEN = ["/account", "/help", "/about"];

/** Pages that show the store's sales, so they need the cashier to be able to read orders. */
export const SALES_PAGES = ["/", "/records", "/reports", "/activity"];

/** What a new cashier gets, and what accounts made before this setting existed (`null`) have. */
export const DEFAULT_PAGES: string[] = CASHIER_PAGES.filter((p) => !("optIn" in p)).map((p) => p.href);

/** A cashier's pages; `null` means the default ones. */
export const cashierPages = (pages: readonly string[] | null | undefined): string[] =>
  pages ? pages.filter((page) => CASHIER_PAGES.some((p) => p.href === page)) : DEFAULT_PAGES;
