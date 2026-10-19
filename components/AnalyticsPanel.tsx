"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Order, Tenant } from "@/lib/types";
import { money } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface AnalyticsPanelProps {
  orders: Order[];
  activeTenant: Tenant;
}

const chartConfig = {
  revenue: { label: "Sales", color: "var(--primary)" },
} satisfies ChartConfig;

function hourLabel(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric" });
}

export function AnalyticsPanel({ orders, activeTenant }: AnalyticsPanelProps) {
  const completed = orders.filter((order) => order.status !== "FAILED");
  const totalSales = completed.reduce((sum, order) => sum + order.total, 0);
  const avgTicket = completed.length > 0 ? totalSales / completed.length : 0;
  const discounts = completed.reduce((sum, order) => sum + (order.discountAmount || 0), 0);

  const hourly = useMemo(() => {
    const buckets = new Map<string, { label: string; revenue: number; sort: number }>();
    completed.forEach((order) => {
      const date = new Date(order.date);
      const sort = date.getHours();
      const key = String(sort);
      const current = buckets.get(key) ?? { label: hourLabel(date), revenue: 0, sort };
      current.revenue += order.total;
      buckets.set(key, current);
    });
    return [...buckets.values()]
      .sort((a, b) => a.sort - b.sort)
      .map((bucket) => ({ hour: bucket.label, revenue: Math.round(bucket.revenue * 100) / 100 }));
  }, [completed]);

  const payments = useMemo(() => {
    const sums: Record<string, number> = { Cash: 0, Card: 0, Wallet: 0 };
    completed.forEach((order) => {
      if (order.paymentMethod === "CASH") sums.Cash += order.total;
      else if (order.paymentMethod === "CARD") sums.Card += order.total;
      else sums.Wallet += order.total;
    });
    return Object.entries(sums).filter(([, value]) => value > 0);
  }, [completed]);

  const cashiers = useMemo(() => {
    const leaders = new Map<string, { sales: number; count: number }>();
    completed.forEach((order) => {
      const name = order.cashierName?.trim();
      if (!name) return;
      const current = leaders.get(name) ?? { sales: 0, count: 0 };
      current.sales += order.total;
      current.count += 1;
      leaders.set(name, current);
    });
    return [...leaders.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  }, [completed]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average sale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{money(activeTenant.currency, avgTicket)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Discounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{money(activeTenant.currency, discounts)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">By hour</CardTitle>
        </CardHeader>
        <CardContent>
          {hourly.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales in this store yet.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-40 w-full">
              <AreaChart data={hourly} margin={{ left: 0, right: 0, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="var(--color-revenue)"
                  stroke="var(--color-revenue)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {payments.length > 0 ? (
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.map(([name, value]) => {
              const share = totalSales > 0 ? (value / totalSales) * 100 : 0;
              return (
                <div key={name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{name}</span>
                    <span className="tabular-nums">{money(activeTenant.currency, value)}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {cashiers.length > 0 ? (
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Cashiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cashiers.map((cashier) => (
              <div key={cashier.name} className="flex items-center gap-3">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-secondary text-xs">
                    {cashier.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{cashier.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cashier.count === 1 ? "1 sale" : `${cashier.count} sales`}
                  </p>
                </div>
                <p className="text-sm tabular-nums">{money(activeTenant.currency, cashier.sales)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
