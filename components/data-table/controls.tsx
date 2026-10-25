"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { ArrowDown01Icon, FilterHorizontalIcon, MultiplicationSignIcon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchBox({
  value,
  onChange,
  placeholder,
  className = "w-full sm:w-64",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <Input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={className}
    />
  );
}

/** Native <select>: keyboard and screen-reader friendly, and works on every phone. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative w-fit max-w-full">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-fit max-w-full field-sizing-content appearance-none truncate rounded-lg bg-input py-0 pr-8 pl-2.5 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        size={16}
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>;
}

/**
 * Toolbar whose search and filters fold behind an icon-only filter button on phones.
 * From md up it's one row, same as Toolbar. `leading` (tabs, a scanner field) and `actions` stay visible.
 */
export function FilterBar({
  children,
  leading,
  actions,
  active = false,
  label = "Search and filters",
}: {
  children: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  /** Show a dot while any filter is narrowing the list, so a closed accordion doesn't hide that. */
  active?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {leading}
      <button
        type="button"
        aria-expanded={open}
        aria-label={active ? `${label} (on)` : label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        className={`relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-border md:hidden ${
          open ? "bg-muted" : "bg-card"
        }`}
      >
        <HugeiconsIcon icon={FilterHorizontalIcon} size={16} className="text-muted-foreground" />
        {active ? <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" /> : null}
      </button>
      {actions ? <div className="ml-auto flex gap-2 md:order-last">{actions}</div> : null}
      <div
        className={`${open ? "flex" : "hidden"} order-last w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 md:order-none md:contents`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * FilterBar action, compact on phones so it fits beside the filter button: icon plus `short` (or `count`), or the icon
 * alone. Icon and full label from md up.
 */
export function ToolbarButton({
  icon,
  label,
  short,
  count,
  className = "",
  ...props
}: ComponentProps<typeof Button> & { icon: IconSvgElement; label: string; short?: string; count?: number }) {
  const full = count ? `${label} (${count})` : label;
  const phone = short ?? (count ? String(count) : undefined);
  return (
    <Button
      aria-label={full}
      title={full}
      className={`max-md:h-9 max-md:rounded-xl ${phone ? "max-md:px-3" : "max-md:w-9 max-md:px-0"} ${className}`}
      {...props}
    >
      <HugeiconsIcon icon={icon} size={16} />
      <span className="max-md:hidden">{full}</span>
      {phone ? <span className="tabular-nums md:hidden">{phone}</span> : null}
    </Button>
  );
}

export function ResetFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      onClick={onClick}
      aria-label="Reset filters"
      title="Reset filters"
    >
      <HugeiconsIcon icon={MultiplicationSignIcon} size={16} />
    </Button>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const matches = (query: string, ...fields: (string | undefined | null)[]) => {
  const q = query.trim().toLowerCase();
  return !q || fields.some((field) => (field ?? "").toLowerCase().includes(q));
};

export type ViewMode = "table" | "cards";

/** A choice remembered on this device. */
function useSaved<V extends string>(key: string, fallback: V, valid: (saved: string) => saved is V) {
  const [value, setValue] = useState<V>(fallback);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null && valid(saved)) setValue(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const change = (next: V) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {}
  };
  return [value, change] as const;
}

/** Table or card view for one page, remembered on this device. */
export const useViewMode = (page: string, fallback: ViewMode) =>
  useSaved(`opentill_view_${page}`, fallback, (saved): saved is ViewMode => saved === "table" || saved === "cards");

/** Column id rows are grouped by ("" for none). Every visit starts at Category, so a past "None" never sticks. */
export const useGroupBy = (fallback = "category") => useState(fallback);

/** "View by column": groups the table's rows under collapsible headers, one per value of the chosen column. */
export function GroupBySelect({
  columns,
  value,
  onChange,
}: {
  columns: { id: string; header: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FilterSelect
      label="View by column"
      value={columns.some((column) => column.id === value) ? value : ""}
      onChange={onChange}
      options={[
        { value: "", label: "View by column: None" },
        ...columns.map((column) => ({ value: column.id, label: `View by column: ${column.header}` })),
      ]}
    />
  );
}

export function ViewBySelect({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <FilterSelect
      label="View by"
      value={value}
      onChange={(next) => onChange(next as ViewMode)}
      options={[
        { value: "table", label: "View by: Table" },
        { value: "cards", label: "View by: Cards" },
      ]}
    />
  );
}
