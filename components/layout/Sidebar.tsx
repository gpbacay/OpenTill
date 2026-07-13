"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tenant } from "@/lib/types";
import {
  TriangleAlert,
  LayoutDashboard,
  ShoppingCart,
  Package,
  History,
  Settings,
  Store,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

interface SidebarProps {
  activeTenant: Tenant;
  offlineQueueCount: number;
  onNavigate?: () => void;
}

const MENU_ITEMS = [
  { id: "home", href: "/", label: "Home", icon: LayoutDashboard },
  { id: "orders", href: "/orders", label: "Orders", icon: ShoppingCart },
  { id: "products", href: "/products", label: "Product", icon: Package },
  { id: "records", href: "/records", label: "Records", icon: History },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
] as const;

function sectionFromPath(pathname: string): string {
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/products")) return "products";
  if (pathname.startsWith("/records")) return "records";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}

export default function Sidebar({
  activeTenant,
  offlineQueueCount,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const activeSection = sectionFromPath(pathname);

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]/95 border-r border-[#024959] text-slate-300">
      <div className="flex h-15 items-center border-b border-[#024959] px-4 shrink-0 bg-[#0D0D0D]">
        <div className="flex items-center gap-2 font-mono">
          <div className="p-1.5 bg-[#208C8C]/10 border border-[#208C8C]/40 rounded-lg text-[#89D9C2] flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(32,140,140,0.15)] animate-pulse">
            <TriangleAlert className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="block text-xs font-extrabold text-white uppercase tracking-tight leading-none">
              {activeTenant.name.length > 18
                ? activeTenant.name.substring(0, 16) + "..."
                : activeTenant.name}
            </span>
            <span className="block text-[8px] text-slate-500 font-mono tracking-widest mt-1">
              {activeTenant.businessType.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 scrollbar-none">
        {MENU_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium transition-all duration-150 border cursor-pointer ${
                isActive
                  ? "bg-[#208C8C]/15 text-white border-[#208C8C]/50 shadow-[0_0_12px_rgba(32,140,140,0.12)] font-bold"
                  : "text-slate-400 border-transparent hover:text-white hover:bg-[#024959]/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={
                    isActive
                      ? "text-[#89D9C2] glow-text-mint"
                      : "text-slate-400 group-hover:text-white"
                  }
                >
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <span>{item.label}</span>
              </div>

              {item.id === "records" && offlineQueueCount > 0 ? (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              ) : isActive ? (
                <ChevronRight className="w-3.5 h-3.5 text-[#89D9C2]" />
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="p-3 border-t border-[#024959] bg-[#0D0D0D] shrink-0 font-mono text-[9px] text-slate-400 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Store className="w-3 h-3 text-[#208C8C]" />
            ACTIVE STORE
          </span>
          <span className="text-white font-bold text-[8px] bg-[#024959] border border-[#208C8C]/35 px-1.5 py-0.2 rounded-full uppercase">
            {activeTenant.currency}
          </span>
        </div>
        <p className="text-slate-300 font-bold truncate leading-tight mt-0.5">
          {activeTenant.name}
        </p>
        <div className="flex items-center gap-1.5 text-[8px] text-slate-500 border-t border-[#024959]/30 pt-1.5 mt-1">
          <ShieldAlert className="w-3 h-3 text-emerald-500" />
          <span>Secured Terminal Access</span>
        </div>
      </div>
    </div>
  );
}
