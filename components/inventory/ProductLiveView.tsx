"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Image01Icon } from "@hugeicons/core-free-icons";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { money } from "@/lib/money";
import { reorderLevel, stockState } from "@/lib/types";
import { useRealtimeStatus } from "@/lib/realtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Fields, PanelSection } from "@/components/data-table/DetailPanel";
import { FormPageSkeleton } from "@/components/loading/PageSkeletons";
import { ProductQrCode } from "./ProductQrCode";

const MOVEMENT_LABEL: Record<string, string> = {
  RESTOCK: "Restock",
  SALE: "Sale",
  ADJUSTMENT: "Adjustment",
  OPENING: "Opening stock",
};

export function ProductLiveView({ productId }: { productId: string }) {
  const { products, tenants, activeTenant, handleSwitchTenant } = usePos();
  const { suppliers, movements, ready } = useOps();
  const realtime = useRealtimeStatus();
  const product = products.find((item) => item.id === productId) ?? null;
  const tenant = product ? tenants.find((item) => item.id === product.tenantId) ?? null : null;

  if (!ready.suppliers || !ready.movements) return <FormPageSkeleton />;

  if (!product || !tenant) {
    return (
      <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-semibold">Product not found</h2>
        <p className="max-w-sm text-sm text-muted-foreground">It may have been removed, or it is not available to this OpenTill account.</p>
        <Button asChild variant="secondary"><Link href="/inventory">Back to inventory</Link></Button>
      </div>
    );
  }

  const state = stockState(product);
  const supplier = suppliers.find((item) => item.id === product.supplierId)?.name ?? "—";
  const recent = movements
    .filter((movement) => movement.productId === product.id)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 10);
  const differentStore = activeTenant?.id !== product.tenantId;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 overflow-y-auto pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/inventory"><HugeiconsIcon icon={ArrowLeft01Icon} size={16} data-icon="inline-start" />Inventory</Link>
        </Button>
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`size-2 rounded-full ${realtime === "live" ? "bg-primary" : realtime === "offline" ? "bg-destructive" : "bg-amber-400"}`} />
          {realtime === "live" ? "Live" : realtime === "offline" ? "Offline · showing saved data" : "Refreshing automatically"}
        </span>
      </div>

      {differentStore ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-3 text-sm">
          <span>This product belongs to {tenant.name}.</span>
          <Button size="sm" onClick={() => handleSwitchTenant(tenant.id)}>Switch store</Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-5 rounded-xl bg-card p-4 sm:p-6">
          {product.image ? (
            <img src={product.image} alt={product.name} className="aspect-[4/3] w-full max-w-sm rounded-xl border border-border object-cover" />
          ) : (
            <div className="flex aspect-[4/3] w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground">
              <HugeiconsIcon icon={Image01Icon} size={32} />
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-all font-mono text-xs text-muted-foreground">{product.id}</p>
              <h2 className="mt-1 text-2xl font-bold">{product.name}</h2>
              {product.sku ? <p className="text-sm text-muted-foreground">SKU {product.sku}</p> : null}
            </div>
            {state === "out" ? (
              <Badge variant="destructive">Out of stock</Badge>
            ) : state === "low" ? (
              <Badge variant="secondary" className="text-amber-400">Low stock</Badge>
            ) : (
              <Badge variant="secondary">In stock</Badge>
            )}
          </div>

          <div>
            <p className="text-4xl font-bold tabular-nums">{product.stock}</p>
            <p className="text-sm text-muted-foreground">units available now</p>
          </div>

          <Fields rows={[
            ["Store", tenant.name],
            ["Category", product.category],
            ["Supplier", supplier],
            ["Selling price", money(tenant.currency, product.price)],
            ["Cost", money(tenant.currency, product.costPrice ?? 0)],
            ["Restock threshold", reorderLevel(product)],
          ]} />

          {product.description ? <p className="text-sm text-muted-foreground">{product.description}</p> : null}

          <PanelSection title="Recent stock activity">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock activity yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {recent.map((movement) => (
                  <li key={movement.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{MOVEMENT_LABEL[movement.type] ?? movement.type}</span>
                      <span className="block text-xs text-muted-foreground">{new Date(movement.date).toLocaleString()}</span>
                    </span>
                    <span className={`shrink-0 font-medium tabular-nums ${movement.quantity < 0 ? "text-amber-400" : "text-primary"}`}>
                      {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelSection>
        </section>

        <aside className="rounded-xl bg-card p-4">
          <ProductQrCode product={product} tenant={tenant} />
        </aside>
      </div>
    </div>
  );
}
