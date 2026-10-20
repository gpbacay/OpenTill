"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full sm:w-64"
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
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-lg bg-input px-2 text-sm text-foreground"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>;
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
