export type RangePreset = "today" | "week" | "30d" | "month" | "lastMonth" | "all" | "custom";

/** A date range as local calendar days ("YYYY-MM-DD"). An empty end means open-ended. */
export interface DateRange {
  preset: RangePreset;
  from: string;
  to: string;
}

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** <input type="date"> value (local day) from an ISO string, and back at local noon so it never shifts days. */
export const toDateInput = (iso: string) => day(new Date(iso));
export const fromDateInput = (value: string) => new Date(`${value}T12:00:00`).toISOString();

export function presetRange(preset: RangePreset, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (preset) {
    case "today":
      return { preset, from: day(now), to: day(now) };
    case "week":
      return { preset, from: day(new Date(y, m, d - 6)), to: day(now) };
    case "30d":
      return { preset, from: day(new Date(y, m, d - 29)), to: day(now) };
    case "month":
      return { preset, from: day(new Date(y, m, 1)), to: day(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { preset, from: day(new Date(y, m - 1, 1)), to: day(new Date(y, m, 0)) };
    default:
      return { preset, from: "", to: "" };
  }
}

export function inRange(iso: string, range: DateRange) {
  const date = toDateInput(iso);
  return (!range.from || date >= range.from) && (!range.to || date <= range.to);
}

/** Shorthand used where a fixed period is enough (e.g. "this month" tiles). */
export const inPeriod = (iso: string, preset: RangePreset) => inRange(iso, presetRange(preset));

const PRESET_VALUES = RANGE_PRESETS.map((p) => p.value);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Read a range from URL params so dashboard links land on the same dates: ?from=..&to=.. or ?preset=today. */
export function rangeFromParams(params: { get: (key: string) => string | null }, fallback: RangePreset): DateRange {
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (DAY.test(from) || DAY.test(to)) {
    return { preset: "custom", from: DAY.test(from) ? from : "", to: DAY.test(to) ? to : "" };
  }
  const preset = params.get("preset") as RangePreset | null;
  return presetRange(preset && PRESET_VALUES.includes(preset) && preset !== "custom" ? preset : fallback);
}

/** Query string that rangeFromParams reads back. */
export const rangeQuery = (range: DateRange) =>
  range.preset === "custom" ? `from=${range.from}&to=${range.to}` : `preset=${range.preset}`;
