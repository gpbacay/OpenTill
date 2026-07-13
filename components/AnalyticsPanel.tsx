"use client";

import React, { useMemo } from "react";
import { Order, Tenant } from "@/lib/types";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Award, Coins, Sparkles, PieChart as PieIcon, BarChart2 } from "lucide-react";

interface AnalyticsPanelProps {
  orders: Order[];
  activeTenant: Tenant;
}

export function AnalyticsPanel({ orders, activeTenant }: AnalyticsPanelProps) {
  const getCurrencySymbol = () => {
    return activeTenant.currency === "EUR" ? "€" : activeTenant.currency === "PHP" ? "₱" : "$";
  };

  // 1. Hourly Trend calculations
  const hourlyData = useMemo(() => {
    const dataMap: { [key: string]: number } = {};
    orders.forEach((o) => {
      try {
        const date = new Date(o.date);
        const hourStr = `${date.getHours().toString().padStart(2, "0")}:00`;
        dataMap[hourStr] = (dataMap[hourStr] || 0) + o.total;
      } catch (e) {
        // ignore invalid dates
      }
    });

    const sortedHours = Object.keys(dataMap).sort();
    if (sortedHours.length === 0) {
      return [
        { hour: "09:00", Revenue: 0 },
        { hour: "12:00", Revenue: 0 },
        { hour: "15:00", Revenue: 0 },
        { hour: "18:00", Revenue: 0 },
      ];
    }

    return sortedHours.map((hour) => ({
      hour,
      Revenue: parseFloat(dataMap[hour].toFixed(2)),
    }));
  }, [orders]);

  // 2. Payment Distribution calculations
  const paymentData = useMemo(() => {
    const sums = { CASH: 0, CARD: 0, MOBILE_WALLET: 0 };
    orders.forEach((o) => {
      if (sums[o.paymentMethod] !== undefined) {
        sums[o.paymentMethod] += o.total;
      }
    });

    return [
      { name: "CASH", value: parseFloat(sums.CASH.toFixed(2)), color: "#208C8C" },
      { name: "CARD", value: parseFloat(sums.CARD.toFixed(2)), color: "#89D9C2" },
      { name: "WALLET", value: parseFloat(sums.MOBILE_WALLET.toFixed(2)), color: "#024959" },
    ].filter((item) => item.value > 0);
  }, [orders]);

  // 3. Cashier Leaderboard calculations
  const cashiersLeaderboard = useMemo(() => {
    const leaders: { [key: string]: { sales: number; count: number } } = {};
    orders.forEach((o) => {
      const name = o.cashierName || "Operator House";
      if (!leaders[name]) {
        leaders[name] = { sales: 0, count: 0 };
      }
      leaders[name].sales += o.total;
      leaders[name].count += 1;
    });

    return Object.keys(leaders)
      .map((name) => ({
        name,
        sales: parseFloat(leaders[name].sales.toFixed(2)),
        count: leaders[name].count,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 3);
  }, [orders]);

  // Overall key metric values
  const metrics = useMemo(() => {
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const avgTicket = orders.length > 0 ? totalSales / orders.length : 0;
    const totalDiscounts = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);

    return {
      totalSales,
      avgTicket,
      totalDiscounts,
    };
  }, [orders]);

  return (
    <div className="bg-[#024959]/10 rounded-xl border border-[#024959] p-3 flex flex-col h-full overflow-y-auto space-y-3 font-mono text-xs scrollbar-none">
      {/* Analytics header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#024959]/30">
        <div>
          <h4 className="text-[10px] text-[#89D9C2] uppercase font-bold tracking-wider">Business Analytics Console</h4>
          <p className="text-[8px] text-slate-400">Real-time workspace statistics & trends</p>
        </div>
        <Sparkles className="w-4 h-4 text-[#89D9C2] animate-pulse" />
      </div>

      {/* Grid of micro stats */}
      <div className="grid grid-cols-2 gap-1.5 shrink-0">
        <div className="bg-[#0D0D0D] border border-[#024959] p-2 rounded-lg">
          <span className="text-[7.5px] text-slate-500 uppercase tracking-wider block">Average Ticket</span>
          <span className="text-[11px] font-bold text-white block mt-0.5">
            {getCurrencySymbol()}
            {metrics.avgTicket.toFixed(2)}
          </span>
        </div>
        <div className="bg-[#0D0D0D] border border-[#024959] p-2 rounded-lg">
          <span className="text-[7.5px] text-slate-500 uppercase tracking-wider block">Promo Saved</span>
          <span className="text-[11px] font-bold text-amber-400 block mt-0.5">
            {getCurrencySymbol()}
            {metrics.totalDiscounts.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Sales trend Area chart */}
      <div className="bg-[#0D0D0D]/60 border border-[#024959] rounded-lg p-2 flex flex-col h-32 shrink-0">
        <div className="flex items-center gap-1 mb-1.5 text-[8.5px] text-slate-400">
          <TrendingUp className="w-3.5 h-3.5 text-[#89D9C2]" />
          <span>REVENUE TIMELINE (HOURLY)</span>
        </div>
        <div className="flex-1 w-full text-[8.5px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <XAxis dataKey="hour" stroke="#024959" tick={{ fill: "#94a3b8" }} />
              <YAxis stroke="#024959" tick={{ fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0D0D0D",
                  borderColor: "#024959",
                  fontSize: "10px",
                  borderRadius: "6px",
                  color: "#fff",
                  fontFamily: "monospace",
                }}
              />
              <Area type="monotone" dataKey="Revenue" stroke="#208C8C" fill="#208C8C" fillOpacity={0.15} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment methods list / chart */}
      <div className="bg-[#0D0D0D]/60 border border-[#024959] rounded-lg p-2.5 space-y-2 shrink-0">
        <div className="flex items-center gap-1.5 text-[8.5px] text-slate-400">
          <PieIcon className="w-3.5 h-3.5 text-[#89D9C2]" />
          <span>PAYMENT METHOD SHARE</span>
        </div>

        {paymentData.length === 0 ? (
          <p className="text-[8px] text-slate-500 text-center py-2">No transaction shares yet.</p>
        ) : (
          <div className="space-y-1.5 text-[8.5px]">
            {paymentData.map((pd) => {
              const pct = ((pd.value / metrics.totalSales) * 100).toFixed(0);
              return (
                <div key={pd.name} className="space-y-0.5">
                  <div className="flex justify-between font-bold text-slate-300">
                    <span>{pd.name}</span>
                    <span>
                      {getCurrencySymbol()}
                      {pd.value.toFixed(2)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1 bg-[#0D0D0D] border border-[#024959]/55 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pd.color }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cashier leaderboard */}
      <div className="bg-[#0D0D0D]/60 border border-[#024959] rounded-lg p-2.5 space-y-1.5 flex-1 min-h-[100px]">
        <div className="flex items-center gap-1 text-[8.5px] text-slate-400">
          <Award className="w-3.5 h-3.5 text-amber-400" />
          <span>CASHIER LEADERBOARD</span>
        </div>

        {cashiersLeaderboard.length === 0 ? (
          <p className="text-[8px] text-slate-500 text-center py-2">No active shifts logged.</p>
        ) : (
          <div className="space-y-1.5 pt-0.5">
            {cashiersLeaderboard.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-[8px] bg-[#024959]/5 p-1 px-1.5 rounded border border-[#024959]/20">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400 font-bold">#{idx + 1}</span>
                  <span className="text-white font-bold">{item.name}</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-[#89D9C2] font-bold">
                    {getCurrencySymbol()}
                    {item.sales.toFixed(2)}
                  </span>{" "}
                  ({item.count} tickets)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
