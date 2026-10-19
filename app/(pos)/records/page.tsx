"use client";

import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { usePos } from "@/contexts/pos-context";
import { money } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function RecordsPage() {
  const {
    activeTenant,
    tenantSyncedOrders,
    mobileRecordsTab,
    setMobileRecordsTab,
    searchHistory,
    setSearchHistory,
  } = usePos();

  if (!activeTenant) return null;
  const query = searchHistory.trim().toLowerCase();
  const sales = tenantSyncedOrders.filter((order) => {
    if (!query) return true;
    return (
      order.id.toLowerCase().includes(query) ||
      (order.customerName || "").toLowerCase().includes(query) ||
      (order.cashierName || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs
        value={mobileRecordsTab}
        onValueChange={(value) => setMobileRecordsTab(value as "logs" | "analytics")}
        className="mb-3 lg:hidden"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="logs">Sales</TabsTrigger>
          <TabsTrigger value="analytics">Reports</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-12">
        <div
          className={`${mobileRecordsTab === "logs" ? "flex" : "hidden"} min-h-0 flex-col gap-3 lg:col-span-8 lg:flex`}
        >
          <Input
            value={searchHistory}
            onChange={(event) => setSearchHistory(event.target.value)}
            placeholder="Search sales"
            aria-label="Search sales"
          />
          <ScrollArea className="min-h-0 flex-1">
            {sales.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {tenantSyncedOrders.length === 0
                  ? "Completed checkouts show up here."
                  : "Nothing matches that search."}
              </p>
            ) : (
              <ul>
                {sales.map((order) => (
                  <li key={order.id} className="flex items-center gap-3 rounded-md px-2 py-3 hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{order.customerName || "Walk-in"}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.paymentMethod === "MOBILE_WALLET" ? "Wallet" : order.paymentMethod === "CARD" ? "Card" : "Cash"}
                        {order.cashierName ? `  ${order.cashierName}` : ""}
                        {"  "}
                        {new Date(order.date).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm font-medium tabular-nums">
                      {money(activeTenant.currency, order.total)}
                    </p>
                    {order.status === "PENDING_SYNC" ? <Badge variant="secondary">Queued</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
        <div className={`${mobileRecordsTab === "analytics" ? "block" : "hidden"} min-h-0 lg:col-span-4 lg:block`}>
          <AnalyticsPanel orders={tenantSyncedOrders} activeTenant={activeTenant} />
        </div>
      </div>
    </div>
  );
}
