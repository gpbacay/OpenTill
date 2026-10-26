import type { Expense, Order, StockMovement, Supplier } from "@/lib/types";
import { countsTowardSales } from "@/lib/void-sale";
import { downloadCsv } from "@/lib/csv";
import { money } from "@/lib/money";
import { toDateInput } from "@/lib/periods";

export type ReportType = "sales" | "products" | "expenses" | "profit" | "restocks";

export const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "products", label: "Product sales" },
  { value: "expenses", label: "Expenses" },
  { value: "profit", label: "Profit and loss" },
  { value: "restocks", label: "Restocks" },
];

/** Report types for a cashier: sales only, no costs, expenses or profit. */
export const reportTypesFor = (cashier: boolean) =>
  cashier ? REPORT_TYPES.filter((t) => t.value === "sales" || t.value === "products") : REPORT_TYPES;

type Kind = "text" | "number" | "money";

/**
 * A finished report: plain data, so the same object renders on screen, prints to PDF, exports to Excel
 * and travels inside a share link. `period` is "YYYY" (a year) or "YYYY-MM" (a month).
 */
export interface Report {
  type: ReportType;
  period: string;
  title: string;
  store: string;
  currency: string;
  generatedAt: string;
  /** The first entry is the report's headline figure. */
  summary: { label: string; value: number; kind?: Kind }[];
  columns: { label: string; kind?: Kind }[];
  rows: (string | number)[][];
  note?: string;
}

export interface ReportData {
  orders: Order[];
  expenses: Expense[];
  movements: StockMovement[];
  suppliers: Supplier[];
}

export const PERIOD = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
export const isYear = (period: string) => period.length === 4;
export const typeLabel = (type: ReportType) => REPORT_TYPES.find((t) => t.value === type)?.label ?? type;

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (value: string) => new Date(`${value}T12:00:00`);

export function periodLabel(period: string) {
  if (isYear(period)) return period;
  return localDay(`${period}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** First and last day ("YYYY-MM-DD") of a period. */
export function periodBounds(period: string) {
  if (isYear(period)) return { from: `${period}-01-01`, to: `${period}-12-31` };
  const [y, m] = period.split("-").map(Number);
  return { from: `${period}-01`, to: `${period}-${pad(new Date(y, m, 0).getDate())}` };
}

/** "Oct 1, 2026 – Oct 31, 2026", or up to `asOf` with "(so far)" while the period is still running. */
export function rangeLabel(period: string, asOf = new Date().toISOString()) {
  const { from, to } = periodBounds(period);
  const today = toDateInput(asOf);
  const ongoing = today >= from && today < to;
  const format = (value: string) => localDay(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${format(from)} – ${format(ongoing ? today : to)}${ongoing ? " (so far)" : ""}`;
}

export const reportHref = (report: { type: ReportType; period: string }) => `/reports/view?type=${report.type}&period=${report.period}`;

export function formatValue(value: string | number, kind: Kind | undefined, currency: string) {
  if (kind === "money") return money(currency, Number(value) || 0);
  if (kind === "number") return (Number(value) || 0).toLocaleString();
  return String(value);
}

/** Days of a month, or months of a year, in order. */
function buckets(period: string) {
  const count = isYear(period) ? 12 : Number(periodBounds(period).to.slice(8));
  return Array.from({ length: count }, (_, i) => `${period}-${pad(i + 1)}`);
}

function bucketLabel(key: string) {
  return key.length === 7
    ? localDay(`${key}-01`).toLocaleDateString(undefined, { month: "long" })
    : localDay(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const total = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((sum, row) => sum + pick(row), 0);

function group<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  });
  return map;
}

const counted = (orders: Order[]) => orders.filter(countsTowardSales);
const restocks = (movements: StockMovement[]) => movements.filter((m) => m.type === "RESTOCK");

export function buildReport(type: ReportType, period: string, data: ReportData, store: { name: string; currency: string }): Report {
  const within = (iso: string) => toDateInput(iso).startsWith(period);
  const bucketOf = (iso: string) => toDateInput(iso).slice(0, isYear(period) ? 7 : 10);
  const timeColumn = { label: isYear(period) ? "Month" : "Date" };
  const sales = counted(data.orders).filter((o) => within(o.date));
  const spent = data.expenses.filter((e) => within(e.date));
  const base = {
    type,
    period,
    title: `${typeLabel(type)} · ${periodLabel(period)}`,
    store: store.name,
    currency: store.currency,
    generatedAt: new Date().toISOString(),
  };

  switch (type) {
    case "sales": {
      const byBucket = group(sales, (o) => bucketOf(o.date));
      const sum = total(sales, (o) => o.total);
      return {
        ...base,
        summary: [
          { label: "Sales", value: sum, kind: "money" },
          { label: "Orders", value: sales.length, kind: "number" },
          { label: "Average sale", value: sales.length ? sum / sales.length : 0, kind: "money" },
          { label: "Discounts", value: total(sales, (o) => o.discountAmount ?? 0), kind: "money" },
        ],
        columns: [timeColumn, { label: "Orders", kind: "number" }, { label: "Discounts", kind: "money" }, { label: "Sales", kind: "money" }],
        rows: buckets(period).map((key) => {
          const list = byBucket.get(key) ?? [];
          return [bucketLabel(key), list.length, total(list, (o) => o.discountAmount ?? 0), total(list, (o) => o.total)];
        }),
      };
    }
    case "products": {
      const byProduct = group(sales.flatMap((o) => o.items ?? []), (item) => item.productId);
      const rows = [...byProduct.values()]
        .map((items) => [items[0].name, total(items, (i) => i.quantity), total(items, (i) => i.price * i.quantity)] as [string, number, number])
        .sort((a, b) => b[2] - a[2]);
      const missing = sales.filter((o) => !o.items?.length).length;
      return {
        ...base,
        summary: [
          { label: "Item sales", value: total(rows, (r) => r[2]), kind: "money" },
          { label: "Units sold", value: total(rows, (r) => r[1]), kind: "number" },
          { label: "Products sold", value: rows.length, kind: "number" },
        ],
        columns: [{ label: "Name" }, { label: "Units", kind: "number" }, { label: "Item sales", kind: "money" }],
        rows,
        note: missing
          ? `Item sales are before discounts and tax. ${missing} ${missing === 1 ? "sale has" : "sales have"} no item details on this device and ${missing === 1 ? "is" : "are"} left out.`
          : "Item sales are before discounts and tax.",
      };
    }
    case "expenses": {
      const rows = [...group(spent, (e) => e.category).entries()]
        .map(([category, list]) => [category, list.length, total(list, (e) => e.amount)] as [string, number, number])
        .sort((a, b) => b[2] - a[2]);
      return {
        ...base,
        summary: [
          { label: "Spent", value: total(spent, (e) => e.amount), kind: "money" },
          { label: "Entries", value: spent.length, kind: "number" },
          { label: "Categories", value: rows.length, kind: "number" },
        ],
        columns: [{ label: "Category" }, { label: "Entries", kind: "number" }, { label: "Amount", kind: "money" }],
        rows,
      };
    }
    case "profit": {
      const salesBy = group(sales, (o) => bucketOf(o.date));
      const spentBy = group(spent, (e) => bucketOf(e.date));
      const salesSum = total(sales, (o) => o.total);
      const spentSum = total(spent, (e) => e.amount);
      return {
        ...base,
        summary: [
          { label: "Left after expenses", value: salesSum - spentSum, kind: "money" },
          { label: "Sales", value: salesSum, kind: "money" },
          { label: "Expenses", value: spentSum, kind: "money" },
        ],
        columns: [timeColumn, { label: "Sales", kind: "money" }, { label: "Expenses", kind: "money" }, { label: "Left after expenses", kind: "money" }],
        rows: buckets(period).map((key) => {
          const s = total(salesBy.get(key) ?? [], (o) => o.total);
          const e = total(spentBy.get(key) ?? [], (x) => x.amount);
          return [bucketLabel(key), s, e, s - e];
        }),
      };
    }
    case "restocks": {
      const received = restocks(data.movements).filter((m) => within(m.date));
      const cost = (m: StockMovement) => m.quantity * (m.unitCost ?? 0);
      const supplierName = (id: string) => data.suppliers.find((s) => s.id === id)?.name ?? "No supplier";
      const rows = [...group(received, (m) => m.supplierId ?? "").entries()]
        .map(([id, list]) => [supplierName(id), list.length, total(list, (m) => m.quantity), total(list, cost)] as [string, number, number, number])
        .sort((a, b) => b[3] - a[3]);
      return {
        ...base,
        summary: [
          { label: "Restock cost", value: total(received, cost), kind: "money" },
          { label: "Units received", value: total(received, (m) => m.quantity), kind: "number" },
          { label: "Restocks", value: received.length, kind: "number" },
        ],
        columns: [{ label: "Supplier" }, { label: "Restocks", kind: "number" }, { label: "Units", kind: "number" }, { label: "Cost", kind: "money" }],
        rows,
      };
    }
  }
}

/** Every month and year that has records for a report type. */
function periodsWithRecords(type: ReportType, data: ReportData) {
  const orderDates = counted(data.orders).map((o) => o.date);
  const expenseDates = data.expenses.map((e) => e.date);
  const dates =
    type === "expenses" ? expenseDates
    : type === "restocks" ? restocks(data.movements).map((m) => m.date)
    : type === "profit" ? [...orderDates, ...expenseDates]
    : orderDates;
  const months = new Set(dates.map((iso) => toDateInput(iso).slice(0, 7)));
  return [...months, ...new Set([...months].map((m) => m.slice(0, 4)))];
}

/** One report per type for every month and year with records, newest first. */
export function allReports(data: ReportData, store: { name: string; currency: string }, types = REPORT_TYPES) {
  // ponytail: builds every report up front (types x periods x records); fine for a shop's history, build lazily if it gets slow.
  return types.flatMap((t) => periodsWithRecords(t.value, data).map((period) => buildReport(t.value, period, data, store))).sort(
    (a, b) =>
      periodBounds(b.period).to.localeCompare(periodBounds(a.period).to) ||
      a.period.length - b.period.length ||
      REPORT_TYPES.findIndex((t) => t.value === a.type) - REPORT_TYPES.findIndex((t) => t.value === b.type)
  );
}

export const reportKey = (report: Pick<Report, "type" | "period">) => `${report.type}:${report.period}`;

/** Excel opens this directly: report details, summary, then the table. Money stays numeric so it can be summed. */
export function downloadReportCsv(report: Report) {
  downloadCsv(`${report.type}-report-${report.period}.csv`, [report.title], [
    [report.store],
    [rangeLabel(report.period, report.generatedAt)],
    [],
    ...report.summary.map((s) => [s.label, s.value]),
    [],
    report.columns.map((c) => c.label),
    ...report.rows,
    ...(report.note ? [[], [report.note]] : []),
    [],
    ["Generated by OpenTill"],
  ]);
}

// Share links carry the whole report, compressed, in the URL fragment: no server needed, works offline,
// and the fragment never reaches any server.
async function pipe(bytes: BufferSource, stream: CompressionStream | DecompressionStream) {
  return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
}

export async function encodeReport(report: Report) {
  const bytes = new Uint8Array(await pipe(new TextEncoder().encode(JSON.stringify(report)), new CompressionStream("deflate-raw")));
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Null when the link is cut off or not a report. */
export async function decodeReport(code: string): Promise<Report | null> {
  try {
    const bytes = Uint8Array.from(atob(code.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const report = JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream("deflate-raw"))));
    const ok =
      typeof report?.title === "string" &&
      typeof report.period === "string" &&
      PERIOD.test(report.period) &&
      Array.isArray(report.summary) &&
      Array.isArray(report.columns) &&
      Array.isArray(report.rows) &&
      report.rows.every((row: unknown) => Array.isArray(row));
    return ok ? report : null;
  } catch {
    return null;
  }
}
