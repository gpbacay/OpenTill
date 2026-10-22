"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import { DateRange, RANGE_PRESETS, RangePreset, presetRange } from "@/lib/periods";

function formatDay(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  const shown = formatDay(value);
  return (
    <div className="relative inline-flex h-8 items-center gap-1.5 rounded-lg bg-input px-2.5 text-sm focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring">
      <span className={shown ? "tabular-nums" : "text-muted-foreground"}>{shown || "Date"}</span>
      <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-muted-foreground" />
      <input
        type="date"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker();
          } catch {
            event.currentTarget.focus();
          }
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </div>
  );
}

/** Quick presets plus exact From / To dates. Picking a preset fills the dates; editing a date switches to "Custom range". */
export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-fit">
        <select
          aria-label="Date range"
          value={value.preset}
          onChange={(event) => {
            const preset = event.target.value as RangePreset;
            onChange(preset === "custom" ? { ...value, preset } : presetRange(preset));
          }}
          className="h-8 w-fit field-sizing-content appearance-none rounded-lg bg-input py-0 pr-8 pl-2.5 text-sm text-foreground"
        >
          {RANGE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      <DateField
        label="From date"
        value={value.from}
        max={value.to || undefined}
        onChange={(from) => onChange({ preset: "custom", from, to: value.to })}
      />
      <span className="text-xs text-muted-foreground">to</span>
      <DateField
        label="To date"
        value={value.to}
        min={value.from || undefined}
        onChange={(to) => onChange({ preset: "custom", from: value.from, to })}
      />
    </div>
  );
}
