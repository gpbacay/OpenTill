"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
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
 * Toolbar whose search and filters fold into a "Search and filters" accordion on phones.
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
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium md:hidden ${
          leading ? "" : "flex-1"
        }`}
      >
        <span className="flex items-center gap-2">
          <HugeiconsIcon icon={FilterHorizontalIcon} size={16} className="text-muted-foreground" />
          {label}
          {active ? <span className="size-2 rounded-full bg-primary" aria-label="Filters on" /> : null}
        </span>
        <HugeiconsIcon icon={ArrowDown01Icon} size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
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

/** Table or card view for one page, remembered on this device. */
export function useViewMode(page: string, fallback: ViewMode) {
  const key = `opentill_view_${page}`;
  const [view, setView] = useState<ViewMode>(fallback);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "table" || saved === "cards") setView(saved);
    } catch {}
  }, [key]);
  const change = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(key, next);
    } catch {}
  };
  return [view, change] as const;
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
