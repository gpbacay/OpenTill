"use client";

import { DateRange, RANGE_PRESETS, RangePreset, presetRange } from "@/lib/periods";
import { Input } from "@/components/ui/input";

/** Quick presets plus exact From / To dates. Picking a preset fills the dates; editing a date switches to "Custom range". */
export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Date range"
        value={value.preset}
        onChange={(event) => {
          const preset = event.target.value as RangePreset;
          onChange(preset === "custom" ? { ...value, preset } : presetRange(preset));
        }}
        className="h-8 rounded-lg bg-input px-2 text-sm text-foreground"
      >
        {RANGE_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
      <Input
        type="date"
        aria-label="From date"
        value={value.from}
        max={value.to || undefined}
        onChange={(event) => onChange({ preset: "custom", from: event.target.value, to: value.to })}
        className="w-36"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        aria-label="To date"
        value={value.to}
        min={value.from || undefined}
        onChange={(event) => onChange({ preset: "custom", from: value.from, to: event.target.value })}
        className="w-36"
      />
    </div>
  );
}
