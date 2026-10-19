"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { FullScreenIcon, MinimizeScreenIcon } from "@hugeicons/core-free-icons";
import { usePos } from "@/contexts/pos-context";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StoreMenu } from "@/components/layout/Sidebar";

function titleFromPath(pathname: string) {
  if (pathname.startsWith("/orders")) return "Register";
  if (pathname.startsWith("/products")) return "Products";
  if (pathname.startsWith("/records")) return "Sales";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/account")) return "Account";
  return "Home";
}

export default function Header() {
  const pathname = usePathname();
  const { isOnline, offlineQueue, isSyncing, triggerOfflineSync, activeTenant } = usePos();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const queued = offlineQueue.filter((entry) => entry.order.tenantId === activeTenant?.id).length;

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
      return;
    }
    void document.exitFullscreen();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 px-4">
      <SidebarTrigger className="hidden md:inline-flex" />
      <h1 className="text-lg font-semibold">{titleFromPath(pathname)}</h1>
      <div className="ml-auto flex items-center gap-2">
        {!isOnline ? (
          <span className="text-sm text-amber-400">Offline</span>
        ) : null}
        {queued > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={isSyncing || !isOnline}
            onClick={() => void triggerOfflineSync()}
          >
            {isSyncing ? "Saving" : `Save ${queued}`}
          </Button>
        ) : null}
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          <HugeiconsIcon icon={isFullscreen ? MinimizeScreenIcon : FullScreenIcon} size={16} />
        </Button>
        <div className="md:hidden">
          <StoreMenu />
        </div>
      </div>
    </header>
  );
}
