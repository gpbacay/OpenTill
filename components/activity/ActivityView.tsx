"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Invoice01Icon,
  Package01Icon,
  TruckDeliveryIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import type { ActivityKind } from "@/lib/activity";
import { useRecentActivity } from "@/hooks/use-recent-activity";
import { Button } from "@/components/ui/button";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";
import { ResetFiltersButton } from "@/components/data-table/controls";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ICONS = {
  sale: Invoice01Icon,
  expense: Wallet01Icon,
  stock: Package01Icon,
  supplier: TruckDeliveryIcon,
} satisfies Record<ActivityKind, typeof Invoice01Icon>;

type ActivityFilter = "all" | "unread" | ActivityKind;

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "sale", label: "Sales" },
  { value: "stock", label: "Inventory" },
  { value: "expense", label: "Expenses" },
  { value: "supplier", label: "Suppliers" },
];

function when(value: string) {
  const date = new Date(value);
  const elapsed = date.getTime() - Date.now();
  const minutes = Math.round(elapsed / 60_000);
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return relative.format(days, "day");
  return date.toLocaleString();
}

export function ActivityView() {
  const { activities, unreadCount, isUnread, markAllRead, ready } = useRecentActivity();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const visibleActivities = useMemo(
    () =>
      activities.filter((item) => {
        if (filter === "all") return true;
        if (filter === "unread") return isUnread(item.date);
        return item.kind === filter;
      }),
    [activities, filter, isUnread],
  );
  const countFor = (value: ActivityFilter) => {
    if (value === "all") return activities.length;
    if (value === "unread") return unreadCount;
    return activities.filter((item) => item.kind === value).length;
  };

  if (!ready) return <TablePageSkeleton stats={0} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 py-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Sales, inventory, expenses, and supplier updates in one place.</p>
          <p className="mt-1 text-xs text-muted-foreground">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 ? (
          <Button variant="secondary" onClick={markAllRead}>Mark all as read</Button>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as ActivityFilter)} className="w-max">
            <TabsList variant="line">
              {FILTERS.map((option) => (
                <TabsTrigger key={option.value} value={option.value} className="gap-1 px-2.5">
                  {option.label}
                  <span className="text-[10px] tabular-nums text-muted-foreground">{countFor(option.value)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {filter !== "all" ? <ResetFiltersButton onClick={() => setFilter("all")} /> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-card">
        {visibleActivities.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {filter === "unread"
              ? "You're all caught up."
              : filter === "all"
                ? "New sales, stock changes, expenses, and suppliers will appear here."
                : `No ${FILTERS.find((option) => option.value === filter)?.label.toLowerCase()} activity yet.`}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {visibleActivities.map((item) => {
              const unread = isUnread(item.date);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex min-h-16 items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <HugeiconsIcon icon={ICONS[item.kind]} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{item.title}</span>
                        {unread ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    <time dateTime={item.date} className="shrink-0 text-right text-xs text-muted-foreground">
                      {when(item.date)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
