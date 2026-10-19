"use client";

import { TenantOnboarding } from "@/components/TenantOnboarding";
import { usePos } from "@/contexts/pos-context";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const { tenants, activeTenant, isDarkMode, setIsDarkMode, handleAddTenant, handleSwitchTenant } =
    usePos();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto py-2">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="dark-theme">Dark theme</Label>
        <Switch
          id="dark-theme"
          checked={isDarkMode}
          onCheckedChange={(checked) => setIsDarkMode(checked)}
        />
      </div>
      <TenantOnboarding
        tenants={tenants}
        activeTenant={activeTenant}
        onAddTenant={handleAddTenant}
        onSwitchTenant={handleSwitchTenant}
      />
    </div>
  );
}
