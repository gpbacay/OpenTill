// Shared by the app and the API (server/), so keep it free of browser or Node-only imports.

/** Pages an admin can turn on or off for each cashier. The Register and the cashier's own Account are always on. */
export const CASHIER_PAGES = [
  { href: "/", label: "Dashboard" },
  { href: "/records", label: "Sales" },
  { href: "/reports", label: "Reports" },
  { href: "/activity", label: "Recent activity" },
  { href: "/help", label: "Help center" },
  { href: "/about", label: "About" },
] as const;

export const ALWAYS_OPEN = ["/orders", "/account"];

/** Pages that show the store's sales, so they need the cashier to be able to read orders. */
export const SALES_PAGES = ["/", "/records", "/reports", "/activity"];

/** A cashier's pages; `null` (accounts made before this setting existed) means all of them. */
export const cashierPages = (pages: readonly string[] | null | undefined): string[] =>
  pages ? pages.filter((page) => CASHIER_PAGES.some((p) => p.href === page)) : CASHIER_PAGES.map((p) => p.href);
