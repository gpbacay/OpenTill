"use client";

import { Tenant } from "@/lib/types";
import { StoreForm } from "@/components/stores/StoreForm";

/** First-run screen: an account with no stores creates its first one. More are managed under Stores. */
export function TenantOnboarding({ tenants, onAddTenant }: { tenants: Tenant[]; onAddTenant: (newTenant: Tenant) => void }) {
  return <StoreForm tenants={tenants} submitLabel="Create store" onSubmit={onAddTenant} />;
}
