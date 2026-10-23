"use client";

import { useState } from "react";
import { Tenant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { FieldError, check, clearError, invalid } from "@/components/FieldError";
import { collect, maxLength, numberError, required, type FieldErrors } from "@/lib/validation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BUSINESSES = ["Retail", "Food & Beverage", "Grocery", "Electronics", "Fashion", "Motorcycle Parts"];
const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD"];

/** Create (no `store`) or edit (`store`) form. Tax is typed as a percent and saved as a fraction (12 → 0.12). */
export function StoreForm({
  tenants,
  store,
  submitLabel,
  onSubmit,
}: {
  tenants: Tenant[];
  store?: Tenant;
  submitLabel: string;
  onSubmit: (tenant: Tenant) => void;
}) {
  const [name, setName] = useState(store?.name ?? "");
  const [businessType, setBusinessType] = useState(store?.businessType ?? "Retail");
  const [currency, setCurrency] = useState(store?.currency ?? "PHP");
  const [tax, setTax] = useState(store ? String(+(store.taxRate * 100).toFixed(2)) : "");
  const [errors, setErrors] = useState<FieldErrors>({});
  // Keep a saved value selectable even if it isn't one of the presets.
  const businesses = BUSINESSES.includes(businessType) ? BUSINESSES : [...BUSINESSES, businessType];
  const currencies = CURRENCIES.includes(currency) ? CURRENCIES : [...CURRENCIES, currency];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    const taken = tenants.some((t) => t.id !== store?.id && t.name.trim().toLowerCase() === trimmed.toLowerCase());
    const ok = check(
      collect({
        "store-name":
          required(name, "Enter a store name.") ??
          maxLength(name, 60, "The store name") ??
          (taken ? `You already have a store called ${trimmed}.` : undefined),
        "store-tax": numberError(tax, "the tax rate", { min: 0, max: 100 }),
      }),
      setErrors
    );
    if (!ok) return;
    onSubmit({
      id: store?.id ?? `tenant-${Date.now()}`,
      name: trimmed,
      businessType,
      taxRate: (Number(tax) || 0) / 100,
      currency,
      createdAt: store?.createdAt ?? new Date().toISOString(),
      active: store?.active ?? true,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="store-name" required>Store name</Label>
        <Input
          id="store-name"
          {...invalid(errors, "store-name")}
          value={name}
          autoFocus
          onChange={(event) => {
            clearError(setErrors, "store-name");
            setName(event.target.value);
          }}
        />
        <FieldError errors={errors} id="store-name" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Business</Label>
          <Select value={businessType} onValueChange={setBusinessType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((business) => (
                <SelectItem key={business} value={business}>
                  {business}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="store-tax">Sales tax (%)</Label>
        <NumberInput
          id="store-tax"
          {...invalid(errors, "store-tax")}
          value={tax}
          placeholder="0"
          onChange={(event) => {
            clearError(setErrors, "store-tax");
            setTax(event.target.value);
          }}
        />
        <FieldError errors={errors} id="store-tax" />
      </div>
      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
