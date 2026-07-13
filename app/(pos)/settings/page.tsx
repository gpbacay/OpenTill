"use client";

import { TenantOnboarding } from "@/components/TenantOnboarding";
import { usePos } from "@/contexts/pos-context";

export default function SettingsPage() {
  const { tenants, activeTenant, handleAddTenant, handleSwitchTenant } =
    usePos();

  return (
    <TenantOnboarding
      tenants={tenants}
      activeTenant={activeTenant}
      onAddTenant={handleAddTenant}
      onSwitchTenant={handleSwitchTenant}
    />
  );
}
