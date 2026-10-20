export const PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function inPeriod(iso: string, period: string, now = new Date()) {
  if (period === "all") return true;
  const date = new Date(iso);
  const today = startOfDay(now);
  switch (period) {
    case "today":
      return date >= today;
    case "week":
      return date >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    case "month":
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    case "lastMonth": {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return date.getFullYear() === last.getFullYear() && date.getMonth() === last.getMonth();
    }
    default:
      return true;
  }
}

/** <input type="date"> value (local day) from an ISO string, and back at local noon so it never shifts days. */
export const toDateInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const fromDateInput = (value: string) => new Date(`${value}T12:00:00`).toISOString();
