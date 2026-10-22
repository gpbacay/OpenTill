"use client";

import type { ComponentProps } from "react";
import { numericInput } from "@/lib/validation";
import { Input } from "@/components/ui/input";

/**
 * Input that only takes numbers as you type: digits, one decimal point (unless `decimals` is off) and a
 * leading minus when `negative` is on. Letters never reach the field, on every browser and phone keyboard.
 */
export function NumberInput({
  decimals = true,
  negative = false,
  onChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & { decimals?: boolean; negative?: boolean }) {
  return (
    <Input
      {...props}
      type="text"
      // Phone keypads: digits (with "." for amounts). Fields that allow a minus keep the full keyboard.
      inputMode={negative ? undefined : decimals ? "decimal" : "numeric"}
      autoComplete="off"
      onChange={(event) => {
        event.target.value = numericInput(event.target.value, { decimals, negative });
        onChange?.(event);
      }}
    />
  );
}
