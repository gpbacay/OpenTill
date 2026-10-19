"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Order, Product, Tenant } from "@/lib/types";
import { money } from "@/lib/money";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  revenue: { label: "Sales", color: "var(--primary)" },
} satisfies ChartConfig;

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function BentoDashboard({
  products,
  orders,
  activeTenant,
}: BentoDashboardProps) {
  const catalog = useMemo(
    () => products.filter((product) => product.tenantId === activeTenant.id),
    [products, activeTenant.id]
  );
  const sales = useMemo(
    () => orders.filter((order) => order.tenantId === activeTenant.id && order.status !== "FAILED"),
    [orders, activeTenant.id]
  );

  const todayKey = dayKey(new Date());
  const todayTotal = sales
    .filter((order) => dayKey(new Date(order.date)) === todayKey)
    .reduce((sum, order) => sum + order.total, 0);
  const allTotal = sales.reduce((sum, order) => sum + order.total, 0);

  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = dayKey(date);
      const revenue = sales
        .filter((order) => dayKey(new Date(order.date)) === key)
        .reduce((sum, order) => sum + order.total, 0);
      return {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        revenue: Math.round(revenue * 100) / 100,
      };
    });
  }, [sales]);

  const lowStock = catalog.filter((product) => product.stock < 5).slice(0, 5);
  const recent = sales.slice(0, 6);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{money(activeTenant.currency, todayTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">All sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{money(activeTenant.currency, allTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{catalog.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="border-0 shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">This week</CardTitle>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <p className="py-10 text-sm text-muted-foreground">
                Sales show up here after the first checkout.
              </p>
            ) : (
              <ChartContainer config={chartConfig} className="h-48 w-full">
                <AreaChart data={week} margin={{ left: 0, right: 0, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
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

        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Low stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing is running low.</p>
            ) : (
              lowStock.map((product) => (
                <div key={product.id} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm">{product.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-amber-400">
                    {product.stock} left
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Recent</CardTitle>
          <CardAction>
            <Link href="/records" className="text-sm text-muted-foreground hover:text-foreground">
              All sales
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-1">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sales yet.{" "}
              <Link href="/orders" className="text-foreground underline-offset-4 hover:underline">
                Open the register
              </Link>
            </p>
          ) : (
            recent.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
                <div>
                  <p className="text-sm">{order.customerName || "Walk-in"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.date).toLocaleString()}
                  </p>
                </div>
                <p className="text-sm font-medium tabular-nums">
                  {money(activeTenant.currency, order.total)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
