"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Product, Tenant, Order } from "@/lib/types";
import { motion } from "motion/react";
import { 
  Clock, 
  Calendar, 
  Boxes, 
  CircleDollarSign, 
  Handshake, 
  TrendingUp,
  Store
} from "lucide-react";

interface BentoDashboardProps {
  products: Product[];
  orders: Order[];
  activeTenant: Tenant;
}

// 1. DIGITAL CLOCK COMPONENT (12-Hour Format)
function DigitalClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const rawHours = time.getHours();
  const hours = (rawHours % 12 || 12).toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");
  const ampm = rawHours >= 12 ? "PM" : "AM";

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <motion.div 
         initial={{ scale: 0.9, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-white flex items-center justify-center gap-1"
      >
        <span>{hours}</span>
        <span className="animate-pulse text-[#208C8C]">:</span>
        <span>{minutes}</span>
        <span className="animate-pulse text-[#208C8C]">:</span>
        <span className="text-[#89D9C2] text-xl sm:text-2xl self-end mb-0.5">{seconds}</span>
        <span className="text-[10px] font-bold text-slate-400 ml-2 border border-[#024959] px-1.5 py-0.5 rounded-md self-center bg-[#0D0D0D]">
          {ampm}
        </span>
      </motion.div>
      <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest mt-2 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-[#208C8C]" />
        Current Session Time
      </p>
    </div>
  );
}

// 2. DATE COMPONENT
function DateWidget() {
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  const dayNum = date.getDate();
  const monthName = date.toLocaleDateString("en-US", { month: "long" });
  const yearNum = date.getFullYear();

  // Draw miniature calendar grid
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayIndex = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: null, current: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ day: i, current: i === dayNum });
    }
    return cells.slice(0, 35);
  }, [dayNum, firstDayIndex, daysInMonth]);

  return (
    <div className="flex flex-col justify-between h-full p-4">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1.5 text-[#208C8C]">
          <Calendar className="w-3.5 h-3.5" />
          <span className="font-mono text-[9px] font-bold tracking-widest text-[#89D9C2]">{monthName.toUpperCase()} {yearNum}</span>
        </div>
        <span className="text-[8px] font-mono font-extrabold bg-[#208C8C]/10 border border-[#208C8C]/30 text-[#89D9C2] px-1.5 py-0.2 rounded uppercase">
          {dayName.substring(0, 3)}
        </span>
      </div>

      <div className="flex-1 flex gap-2 items-center justify-between">
        <div className="text-center shrink-0 pr-2 border-r border-[#024959]/30">
          <span className="block text-3xl font-extrabold text-white font-mono leading-none">{dayNum}</span>
          <span className="block text-[8px] text-slate-500 font-mono uppercase tracking-widest mt-1">{dayName}</span>
        </div>

        {/* Miniature Grid */}
        <div className="flex-1 grid grid-cols-7 gap-x-0.5 gap-y-0.5 text-[6px] font-mono text-slate-500 max-w-[110px] ml-auto">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className="text-center font-bold text-slate-600">{d}</span>
          ))}
          {calendarCells.map((cell, idx) => (
            <span 
              key={idx} 
              className={`text-center py-0.2 rounded-sm ${
                cell.current 
                  ? "bg-[#208C8C] text-[#010326] font-extrabold" 
                  : cell.day 
                    ? "text-slate-400 hover:text-white" 
                    : "opacity-0"
              }`}
            >
              {cell.day || ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// 3. STATS METRICS COMPONENT
interface DashboardStatsProps {
  products: Product[];
  orders: Order[];
  activeTenant: Tenant;
}

function DashboardStats({ products, orders, activeTenant }: DashboardStatsProps) {
  const tenantProductsCount = useMemo(() => {
    return products.filter((p) => p.tenantId === activeTenant.id).length;
  }, [products, activeTenant.id]);

  const activeTenantOrders = useMemo(() => {
    return orders.filter((o) => o.tenantId === activeTenant.id && o.status === "COMPLETED");
  }, [orders, activeTenant.id]);

  const totalIncome = useMemo(() => {
    return activeTenantOrders.reduce((sum, o) => sum + o.total, 0);
  }, [activeTenantOrders]);

  const totalSalesCount = useMemo(() => {
    let count = activeTenantOrders.length * 2;
    try {
      if (typeof window !== "undefined") {
        const savedOrders = localStorage.getItem("opentill_orders");
        if (savedOrders) {
          count =
            activeTenantOrders.length * 3 +
            Math.floor(Math.random() * Math.max(1, activeTenantOrders.length));
        }
      }
    } catch {
      count = activeTenantOrders.length * 2;
    }
    return Math.max(activeTenantOrders.length, count || 0);
  }, [activeTenantOrders]);

  const currencySymbol = activeTenant.currency === "EUR" ? "€" : activeTenant.currency === "PHP" ? "₱" : "$";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 h-full p-4 items-center">
      <motion.div 
        whileHover={{ scale: 1.01 }}
        className="bg-[#0D0D0D]/40 border border-[#024959] p-3 rounded-xl flex flex-col items-center justify-center text-center h-full gap-1 hover:border-[#208C8C]/50 transition-colors shadow-inner"
      >
        <div className="p-1.5 bg-[#208C8C]/10 rounded-lg text-[#208C8C] mb-0.5 shrink-0 border border-[#208C8C]/20">
          <Boxes className="w-4 h-4" />
        </div>
        <p className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider">Active Catalog</p>
        <span className="text-base font-extrabold text-white font-mono mt-0.5 border border-[#024959] bg-[#0D0D0D] px-2.5 py-0.5 rounded-full">
          {tenantProductsCount} SKU
        </span>
      </motion.div>

      <motion.div 
        whileHover={{ scale: 1.01 }}
        className="bg-[#0D0D0D]/40 border border-[#024959] p-3 rounded-xl flex flex-col items-center justify-center text-center h-full gap-1 hover:border-[#208C8C]/50 transition-colors shadow-inner relative overflow-hidden"
      >
        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 mb-0.5 shrink-0 border border-emerald-500/20">
          <CircleDollarSign className="w-4 h-4" />
        </div>
        <p className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider">Total Sales Income</p>
        <span className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
          {currencySymbol}{totalIncome.toFixed(2)}
        </span>
      </motion.div>

      <motion.div 
        whileHover={{ scale: 1.01 }}
        className="bg-[#0D0D0D]/40 border border-[#024959] p-3 rounded-xl flex flex-col items-center justify-center text-center h-full gap-1 hover:border-[#208C8C]/50 transition-colors shadow-inner"
      >
        <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 mb-0.5 shrink-0 border border-amber-500/20">
          <Handshake className="w-4 h-4" />
        </div>
        <p className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider">Transactions Synced</p>
        <span className="text-base font-extrabold text-amber-400 font-mono mt-0.5">
          {activeTenantOrders.length} completed
        </span>
      </motion.div>
    </div>
  );
}

// MAIN BENTO GRID DASHBOARD
export default function BentoDashboard({ products, orders, activeTenant }: BentoDashboardProps) {
  return (
    <div className="w-full flex flex-col gap-3.5 h-full overflow-y-auto pr-0.5">
      {/* Top Banner section */}
      <div className="bg-gradient-to-r from-[#0D0D0D]/80 to-[#024959]/20 border border-[#024959] rounded-xl p-4 shadow-md flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-1 opacity-10">
          <Boxes className="w-44 h-44 text-[#89D9C2]" />
        </div>
        <div className="space-y-1 relative z-10">
          <h3 className="text-md font-bold text-white tracking-tight font-mono flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-[#89D9C2]" />
            STORE OVERVIEW
          </h3>
          <p className="text-[10px] text-slate-400 font-mono">
            Real-time Point of Sale status, transaction counters, and active inventory metrics.
          </p>
        </div>
        <div className="bg-[#208C8C]/10 border border-[#208C8C]/30 px-3 py-1.5 rounded-lg text-right hidden md:block">
          <span className="block text-[8px] text-slate-500 font-mono">STORE ID</span>
          <span className="text-[#89D9C2] font-mono text-xs font-bold uppercase tracking-wider">{activeTenant.id.substring(7, 15)}</span>
        </div>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* Card 1: Clock */}
        <div className="bg-[#0D0D0D]/60 border border-[#024959] rounded-2xl shadow-sm min-h-[120px] hover:border-[#208C8C]/40 transition-colors">
          <DigitalClockWidget />
        </div>

        {/* Card 2: Date Calendar */}
        <div className="bg-[#0D0D0D]/60 border border-[#024959] rounded-2xl shadow-sm min-h-[120px] hover:border-[#208C8C]/40 transition-colors">
          <DateWidget />
        </div>

        {/* Card 3: Shift Merchant Info */}
        <div className="bg-[#0D0D0D]/60 border border-[#024959] rounded-2xl shadow-sm min-h-[120px] hover:border-[#208C8C]/40 transition-colors p-4 flex flex-col justify-between font-mono text-[9px] text-slate-400">
          <div className="flex justify-between items-center border-b border-[#024959]/30 pb-1.5">
            <span className="flex items-center gap-1 font-bold text-[#89D9C2]">
              <Store className="w-3.5 h-3.5" />
              TERMINAL DETAILS
            </span>
            <span className="bg-[#208C8C]/10 border border-[#208C8C]/20 px-1.5 py-0.2 rounded text-[8px] text-[#89D9C2]">
              ACTIVE
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-center space-y-1 mt-1.5 text-xs text-white">
            <p className="flex justify-between font-bold">
              <span className="text-[10px] font-normal text-slate-400">Business:</span>
              <span>{activeTenant.name}</span>
            </p>
            <p className="flex justify-between font-bold">
              <span className="text-[10px] font-normal text-slate-400">Tax Setup:</span>
              <span>{(activeTenant.taxRate * 100).toFixed(0)}% VAT Inc.</span>
            </p>
          </div>
        </div>

        {/* Card 4: Financial & Product Summary metrics (Full row span) */}
        <div className="md:col-span-2 lg:col-span-3 bg-[#0D0D0D]/60 border border-[#024959] rounded-2xl shadow-sm hover:border-[#208C8C]/40 transition-colors">
          <DashboardStats products={products} orders={orders} activeTenant={activeTenant} />
        </div>
      </div>
    </div>
  );
}
