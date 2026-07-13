"use client";

import {
  FileText,
  TrendingUp,
  Terminal,
  CheckCircle,
} from "lucide-react";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { usePos } from "@/contexts/pos-context";

export default function RecordsPage() {
  const {
    activeTenant,
    tenantSyncedOrders,
    mobileRecordsTab,
    setMobileRecordsTab,
    searchHistory,
    setSearchHistory,
  } = usePos();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex lg:hidden bg-[#0D0D0D] border border-[#024959] p-1 rounded-xl mb-3 shrink-0">
        <button
          onClick={() => setMobileRecordsTab("logs")}
          className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileRecordsTab === "logs"
              ? "bg-[#208C8C] text-[#010326] shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Sales Ledger
        </button>
        <button
          onClick={() => setMobileRecordsTab("analytics")}
          className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileRecordsTab === "analytics"
              ? "bg-[#208C8C] text-[#010326] shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Analytics Reports
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-full overflow-hidden">
        <div
          className={`${
            mobileRecordsTab === "logs" ? "flex" : "hidden"
          } lg:flex lg:col-span-8 flex-col bg-[#024959]/10 rounded-xl border border-[#024959] p-3 overflow-hidden shadow-md`}
        >
          <div className="flex justify-between items-center mb-3 shrink-0">
            <div>
              <h4 className="text-[10px] font-mono text-[#89D9C2] uppercase tracking-wider">
                Synced sales ledger
              </h4>
              <p className="text-[9px] text-slate-400">
                Row counts synced with Cloud Postgres (Neon Database).
              </p>
            </div>
            <div className="bg-[#208C8C]/15 border border-[#208C8C]/30 px-2 py-0.5 rounded text-[9px] font-mono text-[#89D9C2]">
              Total Records: {tenantSyncedOrders.length}
            </div>
          </div>

          <div className="relative mb-3 shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#89D9C2]/60">
              <Terminal className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Filter terminal audit log rows by transaction ID..."
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg py-1.5 pl-8.5 pr-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C] transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-0.5 space-y-2">
            {tenantSyncedOrders.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-5 bg-[#024959]/5 rounded-lg border border-dashed border-[#024959]">
                <FileText className="w-7 h-7 text-[#024959] mb-1.5" />
                <p className="text-[10px] text-slate-400 font-mono">
                  No transactional data logged.
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
                  Complete checkout orders in the register to see records.
                </p>
              </div>
            ) : (
              tenantSyncedOrders
                .filter((o) =>
                  o.id.toLowerCase().includes(searchHistory.toLowerCase())
                )
                .map((o) => (
                  <div
                    key={o.id}
                    className="bg-[#0D0D0D]/45 hover:bg-[#024959]/10 p-3 rounded-lg border border-[#024959] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 transition-all"
                  >
                    <div className="space-y-0.5 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-white">
                          Order ID: {o.id.substring(4, 12).toUpperCase()}
                        </span>
                        <span className="text-[8px] bg-[#208C8C]/15 text-[#89D9C2] px-1 py-0.2 rounded border border-[#208C8C]/10">
                          {o.paymentMethod}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-[8.5px] text-slate-400">
                        <span>
                          Cashier:{" "}
                          <span className="text-white">
                            {o.cashierName || "System Operator"}
                          </span>
                        </span>
                        <span>•</span>
                        <span>
                          Customer:{" "}
                          <span className="text-[#89D9C2]">
                            {o.customerName || "Walk-In Guest"}
                          </span>
                        </span>
                        <span>•</span>
                        <span>
                          Timestamp:{" "}
                          <span className="text-slate-300">
                            {new Date(o.date).toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right font-mono">
                        <span className="text-[12px] font-bold text-[#89D9C2] glow-text-mint">
                          {activeTenant.currency === "EUR"
                            ? "€"
                            : activeTenant.currency === "PHP"
                              ? "₱"
                              : "$"}
                          {o.total.toFixed(2)}
                        </span>
                        <p className="text-[7.5px] text-slate-500">
                          VAT Inc:{" "}
                          {activeTenant.currency === "EUR"
                            ? "€"
                            : activeTenant.currency === "PHP"
                              ? "₱"
                              : "$"}{" "}
                          {o.tax.toFixed(2)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-[8px] font-mono bg-[#0D0D0D] px-2 py-1 rounded border border-[#024959]/50 text-slate-300 shadow-inner">
                        <CheckCircle className="w-3 h-3 text-[#89D9C2]" />
                        <span className="text-[#89D9C2] font-semibold">
                          POSTGRES_SYNCED
                        </span>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div
          className={`${
            mobileRecordsTab === "analytics" ? "block" : "hidden"
          } lg:block lg:col-span-4 h-full`}
        >
          <AnalyticsPanel
            orders={tenantSyncedOrders}
            activeTenant={activeTenant}
          />
        </div>
      </div>
    </div>
  );
}
