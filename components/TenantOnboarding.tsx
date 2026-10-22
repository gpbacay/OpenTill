"use client";

import { useState } from "react";
import { Tenant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantOnboardingProps {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  onAddTenant: (newTenant: Tenant) => void;
  onSwitchTenant: (tenantId: string) => void;
}

const BUSINESSES = [
  "Retail",
  "Food & Beverage",
  "Grocery",
  "Electronics",
  "Fashion",
  "Motorcycle Parts",
];

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD"];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TenantOnboarding({
  tenants,
  activeTenant,
  onAddTenant,
  onSwitchTenant,
}: TenantOnboardingProps) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("Retail");
  const [currency, setCurrency] = useState("PHP");
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a store name.");
      return;
    }
    onAddTenant({
      id: `tenant-${Date.now()}`,
      name: name.trim(),
      businessType,
      taxRate: 0,
      currency,
      createdAt: new Date().toISOString(),
      active: true,
    });
    setName("");
    setError("");
  };

  return (
    <div className={`grid gap-4 ${tenants.length > 0 ? "lg:grid-cols-2" : ""} h-full overflow-y-auto`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="space-y-1">
          <Label htmlFor="store-name">Store name</Label>
          <Input id="store-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Business</Label>
            <Select value={businessType} onValueChange={setBusinessType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUSINESSES.map((business) => (
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
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" className="w-full">
          Create store
        </Button>
      </form>

      {tenants.length > 0 ? (
        <div className="space-y-2">
          {tenants.map((tenant) => {
            const current = tenant.id === activeTenant?.id;
            return (
              <Card
                key={tenant.id}
                role={current ? undefined : "button"}
                tabIndex={current ? undefined : 0}
                aria-current={current ? "true" : undefined}
                className={`border-0 shadow-none ${current ? "bg-accent" : "cursor-pointer hover:bg-accent"}`}
                onClick={current ? undefined : () => onSwitchTenant(tenant.id)}
                onKeyDown={
                  current
                    ? undefined
                    : (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSwitchTenant(tenant.id);
                        }
                      }
                }
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                      {initials(tenant.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{tenant.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {tenant.businessType} {tenant.currency}
                    </span>
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
