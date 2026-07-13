"use client";

import { X, RefreshCw } from "lucide-react";
import { PosProvider, usePos } from "@/contexts/pos-context";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

function PosShell({ children }: { children: React.ReactNode }) {
  const {
    activeTenant,
    offlineQueue,
    isOnline,
    isSyncing,
    syncProgress,
    isDarkMode,
    mobileMenuOpen,
    setMobileMenuOpen,
    setIsDarkMode,
    handleNetworkToggle,
    triggerOfflineSync,
  } = usePos();

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-slate-100 flex flex-row antialiased select-none">
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0">
        <Sidebar
          activeTenant={activeTenant}
          offlineQueueCount={offlineQueue.length}
        />
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-fade-in">
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          ></div>
          <div className="relative flex w-64 max-w-xs flex-col bg-[#0D0D0D] border-r border-[#024959] h-full shadow-2xl animate-slide-in-left">
            <div className="absolute top-3.5 right-3 z-50">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md border border-[#024959] text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Sidebar
              activeTenant={activeTenant}
              offlineQueueCount={offlineQueue.length}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          isOnline={isOnline}
          onToggleNetwork={handleNetworkToggle}
          activeTenant={activeTenant}
          offlineQueueCount={offlineQueue.length}
          onTriggerSync={triggerOfflineSync}
          isSyncing={isSyncing}
          onMobileMenuToggle={() => setMobileMenuOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />

        {isSyncing && (
          <div className="bg-gradient-to-r from-[#024959] to-[#010326] border-b border-[#208C8C]/40 text-center py-2 px-4 shrink-0 animate-pulse">
            <div className="max-w-md mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#89D9C2]">
                <RefreshCw className="w-3 h-3 animate-spin text-[#89D9C2]" />
                <span>
                  Restoring offline transactions to Cloud database (Postgres)...
                </span>
              </div>
              <span className="text-[10px] font-bold text-white font-mono">
                {syncProgress}%
              </span>
            </div>
            <div className="max-w-md mx-auto h-0.5 bg-[#010326] rounded-full overflow-hidden mt-1.5 border border-[#208C8C]/20">
              <div
                className="h-full bg-gradient-to-r from-[#208C8C] to-[#89D9C2] transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-hidden p-3 md:p-5 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <PosProvider>
      <PosShell>{children}</PosShell>
    </PosProvider>
  );
}
