"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { FullScreenIcon, Menu01Icon, MinimizeScreenIcon, Notification03Icon } from "@hugeicons/core-free-icons";
import { useAuth } from "@/contexts/auth-context";
import { usePos } from "@/contexts/pos-context";
import { useRecentActivity } from "@/hooks/use-recent-activity";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Breadcrumbs, HistoryButtons } from "@/components/layout/Breadcrumbs";
import { canOpen } from "@/components/layout/Sidebar";

export default function Header() {
  const { isOnline, offlineQueue, isSyncing, triggerOfflineSync, activeTenant } = usePos();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { unreadCount } = useRecentActivity();
  const { user } = useAuth();
  const { setOpenMobile } = useSidebar();
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
    <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4">
      <SidebarTrigger className="hidden md:inline-flex" />
      <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setOpenMobile(true)} aria-label="Open menu">
        <HugeiconsIcon icon={Menu01Icon} size={20} />
      </Button>
      <Breadcrumbs />
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {!isOnline ? (
          <span className="hidden text-sm text-amber-400 sm:inline">Offline: changes are saved on this device</span>
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
        {canOpen(user, "/activity") ? (
          <Button asChild size="icon" variant="ghost" className="relative">
            <Link href="/activity" aria-label={`Recent activity${unreadCount ? `, ${unreadCount} unread` : ""}`} title="Recent activity">
              <HugeiconsIcon icon={Notification03Icon} size={17} />
              {unreadCount > 0 ? (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background" />
              ) : null}
            </Link>
          </Button>
        ) : null}
        <Button
          size="icon"
          variant="ghost"
          className="hidden sm:inline-flex"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          <HugeiconsIcon icon={isFullscreen ? MinimizeScreenIcon : FullScreenIcon} size={16} />
        </Button>
        <HistoryButtons />
      </div>
    </header>
  );
}
