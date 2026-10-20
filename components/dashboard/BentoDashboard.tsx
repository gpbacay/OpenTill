"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Order, Product, Tenant, stockState } from "@/lib/types";
import { useOps } from "@/contexts/ops-context";
import { DateRange, inRange, presetRange, rangeQuery, toDateInput } from "@/lib/periods";
import { money } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/data-table/DateRangeFilter";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface BentoDashboardProps {
  products: Product[];
  orders: Order[];
  activeTenant: Tenant;
}

const chartConfig = {
  sales: { label: "Sales", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-3)" },
} satisfies ChartConfig;

const MAX_DAILY_POINTS = 92;

/** A dashboard card whose corner arrow jumps to the page behind it. */
function DashCard({
  title,
  href,
  open,
  className,
  children,
}: {
  title: ReactNode;
  href: string;
  /** Screen-reader label for the arrow, e.g. "Open sales". */
  open: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`relative border-0 shadow-none ${className ?? ""}`}>
      <Button asChild size="icon-sm" variant="secondary" className="absolute top-3 right-3 rounded-full">
        <Link href={href} aria-label={open} title={open}>
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} />
        </Link>
      </Button>
      <CardHeader className="pr-12">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
const round = (n: number) => Math.round(n * 100) / 100;

export default function BentoDashboard({
  products,
  orders,
  activeTenant,
}: BentoDashboardProps) {
  const { expenses, suppliers, movements } = useOps();
  const [range, setRange] = useState<DateRange>(() => presetRange("month"));
  const currency = activeTenant.currency;
  const query = rangeQuery(range);

  const catalog = useMemo(
    () => products.filter((product) => product.tenantId === activeTenant.id),
    [products, activeTenant.id]
  );
  const allSales = useMemo(
    () => orders.filter((order) => order.tenantId === activeTenant.id && order.status !== "FAILED"),
    [orders, activeTenant.id]
  );
  const sales = useMemo(() => allSales.filter((order) => inRange(order.date, range)), [allSales, range]);
  const spent = useMemo(() => expenses.filter((e) => inRange(e.date, range)), [expenses, range]);

  const salesTotal = sum(sales, (o) => o.total);
  const expenseTotal = sum(spent, (e) => e.amount);
  const left = salesTotal - expenseTotal;
  const stockValue = sum(catalog, (p) => Math.max(0, p.stock) * (p.costPrice ?? 0));

  // Sales and expenses per day across the range; per month once the range is too long to read.
  const trend = useMemo(() => {
    const today = toDateInput(new Date().toISOString());
    const dates = [...allSales.map((o) => o.date), ...expenses.map((e) => e.date)].map(toDateInput).sort();
    const from = range.from || dates[0] || today;
    const to = range.to || today;
    if (from > to) return [];
    const start = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const monthly = days > MAX_DAILY_POINTS;
    const key = (iso: string) => toDateInput(iso).slice(0, monthly ? 7 : 10);
    const buckets = new Map<string, { label: string; sales: number; expenses: number }>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = key(d.toISOString());
      if (!buckets.has(k)) {
        buckets.set(k, {
          label: d.toLocaleDateString("en-US", monthly ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" }),
          sales: 0,
          expenses: 0,
        });
      }
    }
    sales.forEach((o) => {
      const bucket = buckets.get(key(o.date));
      if (bucket) bucket.sales += o.total;
    });
    spent.forEach((e) => {
      const bucket = buckets.get(key(e.date));
      if (bucket) bucket.expenses += e.amount;
    });
    return [...buckets.values()].map((b) => ({ ...b, sales: round(b.sales), expenses: round(b.expenses) }));
  }, [allSales, expenses, sales, spent, range]);

  const lowStockAll = catalog.filter((product) => stockState(product) !== "ok").sort((a, b) => a.stock - b.stock);
  const lowStock = lowStockAll.slice(0, 6);
  const recent = useMemo(() => [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), [sales]);
  const activeSuppliers = suppliers.filter((s) => s.active);
  const deliveries = useMemo(
    () =>
      movements
        .filter((m) => m.type === "RESTOCK" && m.supplierId && inRange(m.date, range))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
    [movements, range]
  );
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "Supplier";

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href="/orders">New sale</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/inventory">Restock</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/expenses">Add expense</Link>
        </Button>
        <div className="ml-auto">
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashCard title="Sales" href={`/records?${query}`} open="Open sales for this date range">
          <p className="text-2xl font-bold tabular-nums">{money(currency, salesTotal)}</p>
          <p className="text-xs text-muted-foreground">
            {sales.length} {sales.length === 1 ? "order" : "orders"}
            {sales.length > 0 ? ` · ${money(currency, salesTotal / sales.length)} average` : ""}
          </p>
        </DashCard>
        <DashCard title="Expenses" href={`/expenses?${query}`} open="Open expenses for this date range">
          <p className="text-2xl font-bold tabular-nums">{money(currency, expenseTotal)}</p>
          <p className="text-xs text-muted-foreground">
            {spent.length} {spent.length === 1 ? "entry" : "entries"}
          </p>
        </DashCard>
        <DashCard title="Left after expenses" href={`/expenses?${query}`} open="Open expenses for this date range">
          <p className={`text-2xl font-bold tabular-nums ${left < 0 ? "text-destructive" : ""}`}>{money(currency, left)}</p>
          <p className="text-xs text-muted-foreground">Sales minus expenses</p>
        </DashCard>
        <DashCard title="Stock value now" href="/inventory" open="Open inventory">
          <p className="text-2xl font-bold tabular-nums">{money(currency, stockValue)}</p>
          <p className="text-xs text-muted-foreground">{catalog.length} products</p>
        </DashCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <DashCard title="Sales and expenses" href={`/records?${query}`} open="Open sales for this date range" className="lg:col-span-2">
          {trend.length === 0 || (salesTotal === 0 && expenseTotal === 0) ? (
            <p className="py-10 text-sm text-muted-foreground">Nothing recorded in this date range.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <AreaChart data={trend} margin={{ left: 0, right: 0, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="sales" type="monotone" fill="var(--color-sales)" stroke="var(--color-sales)" fillOpacity={0.2} />
                <Area dataKey="expenses" type="monotone" fill="var(--color-expenses)" stroke="var(--color-expenses)" fillOpacity={0.12} />
              </AreaChart>
            </ChartContainer>
          )}
        </DashCard>

        <DashCard
          title={`Needs restocking${lowStockAll.length > 0 ? ` (${lowStockAll.length})` : ""}`}
          href="/inventory?status=restock"
          open="Open low stock in inventory"
        >
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is running low.</p>
          ) : (
            <ul className="space-y-1">
              {lowStock.map((product) => (
                <li key={product.id}>
                  <Link
                    href="/inventory?status=restock"
                    className="-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1 hover:bg-accent"
                  >
                    <span className="truncate text-sm">{product.name}</span>
                    <span className="shrink-0 text-sm tabular-nums text-amber-400">
                      {product.stock <= 0 ? "Out" : `${product.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <DashCard title="Recent sales" href={`/records?${query}`} open="Open sales for this date range" className="lg:col-span-2">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sales in this date range.{" "}
              <Link href="/orders" className="text-foreground underline-offset-4 hover:underline">
                Open the register
              </Link>
            </p>
          ) : (
            <ul className="space-y-1">
              {recent.map((order) => (
                <li key={order.id} className="-mx-2 flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
                  <div>
                    <p className="text-sm">{order.customerName || "Walk-in"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.date).toLocaleString()}</p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{money(currency, order.total)}</p>
                </li>
              ))}
            </ul>
          )}
        </DashCard>

        <DashCard title="Suppliers" href="/suppliers" open="Open suppliers">
          <p className="text-2xl font-bold tabular-nums">{activeSuppliers.length}</p>
          <p className="mb-3 text-xs text-muted-foreground">active suppliers</p>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries in this date range.</p>
          ) : (
            <ul className="space-y-1.5">
              {deliveries.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{supplierName(m.supplierId)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </DashCard>
      </div>
    </div>
  );
}
