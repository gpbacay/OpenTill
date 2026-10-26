"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { PosProvider, usePos } from "@/contexts/pos-context";
import { OpsProvider } from "@/contexts/ops-context";
import AppSidebar, { MENU_ITEMS, canOpen } from "@/components/layout/Sidebar";
import { isCashier } from "@/lib/local-auth";
import { ALWAYS_OPEN } from "@/lib/cashier-pages";
import { enableOfflinePages } from "@/lib/offline";
import Header from "@/components/layout/Header";
import { AddMenu } from "@/components/layout/AddMenu";
import { TenantOnboarding } from "@/components/TenantOnboarding";
import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppShellSkeleton } from "@/components/loading/PageSkeletons";
import { useIsMobile } from "@/hooks/use-mobile";

const TABS = ["home", "orders", "inventory", "records"].map((id) => MENU_ITEMS.find((item) => item.id === id)!);
// Cashiers can't open Suppliers or Inventory, so their bar holds the pages they use instead.
const CASHIER_TABS = ["home", "orders", "records", "reports", "activity"].map((id) => MENU_ITEMS.find((item) => item.id === id)!);

// Leave sideways gestures to fields, charts and anything that scrolls sideways (tables).
function usesSideways(el: HTMLElement | null, root: HTMLElement) {
  for (; el && el !== root; el = el.parentElement) {
    if (el.matches("input, textarea, select, [data-slot=chart]")) return true;
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth) return true;
  }
  return false;
}

function PosShell({ children }: { children: React.ReactNode }) {
  const {
    hydrated,
    activeTenant,
    tenants,
    isSyncing,
    syncProgress,
    handleAddTenant,
    autoHideNav,
  } = usePos();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const cashier = isCashier(user);
  const tabs = cashier ? CASHIER_TABS.filter((item) => canOpen(user, item.href)) : TABS;
  const bottomBar = tabs.length > 0;
  const tabIndex = tabs.findIndex((item) => item.href === pathname);
  // Cashiers can't open back-office pages (the API refuses their writes too); send them to the register.
  const blocked = !canOpen(user, pathname);
  useEffect(() => {
    if (blocked) router.replace("/orders");
  }, [blocked, router]);

  // Auto-hide: the bottom bar slides away after a few idle seconds and comes back on any touch or scroll.
  const [navHidden, setNavHidden] = useState(false);
  useEffect(() => {
    if (!autoHideNav || !bottomBar) return;
    let timer = 0;
    const hide = () => {
      // Keep it up while its "+" menu is open.
      if (document.querySelector("[data-bottom-nav] [aria-expanded=true]")) timer = window.setTimeout(hide, 3000);
      else setNavHidden(true);
    };
    const show = () => {
      setNavHidden(false);
      clearTimeout(timer);
      timer = window.setTimeout(hide, 3000);
    };
    timer = window.setTimeout(hide, 3000);
    window.addEventListener("pointerdown", show);
    document.addEventListener("scroll", show, true); // capture: scroll doesn't bubble from the page's scroll areas
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", show);
      document.removeEventListener("scroll", show, true);
      setNavHidden(false);
    };
  }, [autoHideNav, bottomBar]);

  // Swipe between the bottom bar's pages on phones. Touches near the screen edges stay with the browser's back gesture.
  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    const target = event.target as HTMLElement;
    swipeStart.current =
      isMobile &&
      tabIndex >= 0 &&
      event.touches.length === 1 &&
      event.currentTarget.contains(target) && // ignore dialogs portaled out of the page
      touch.clientX > 24 &&
      touch.clientX < window.innerWidth - 24 &&
      !usesSideways(target, event.currentTarget)
        ? { x: touch.clientX, y: touch.clientY }
        : null;
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const next = tabs[tabIndex + (dx < 0 ? 1 : -1)];
    if (next) router.push(next.href);
  };

  if (!hydrated || blocked) {
    return <AppShellSkeleton />;
  }

  if (!activeTenant && pathname === "/account") {
    return <div className="min-h-screen bg-background px-6">{children}</div>;
  }

  if (!activeTenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md">
          <h1 className="mb-1 text-3xl font-bold">{cashier ? "Loading your store" : "Open your store"}</h1>
          <p className="mb-2 text-sm text-muted-foreground">
            {cashier
              ? "Your register opens once your store has loaded. Connect to the internet if this takes long, or ask your admin to check your account."
              : "Sales and products stay with the store you create."}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">Signed in as {user?.name}</p>
          <div className="mb-6 flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/account">Account</Link>
            </Button>
            <LogoutButton>
              <Button variant="ghost">Log out</Button>
            </LogoutButton>
          </div>
          {cashier ? null : <TenantOnboarding tenants={tenants} onAddTenant={handleAddTenant} />}
        </div>
      </div>
    );
  }

  return (
    <OpsProvider userId={user?.id ?? ""}>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden shadow-none">
        <Header />
        {isSyncing ? (
          <div className="h-0.5 bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        ) : null}
        <main
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 sm:px-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => (swipeStart.current = null)}
        >
          {children}
        </main>
        {/* The bar sits in the page's flow rather than floating over a strip kept free for it; hiding it folds its row
            away (0fr), so the page grows into the space instead of leaving an empty band behind. */}
        {bottomBar ? (
        <div
          className={`grid shrink-0 transition-[grid-template-rows,opacity] duration-300 md:hidden ${
            navHidden ? "pointer-events-none grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
          }`}
        >
        <div className="min-h-0 overflow-hidden">
        <nav
          aria-label="Main"
          data-bottom-nav
          className="flex items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {/* Bar and "+" share one height and corner radius; tabs use the inner radius (outer minus the bar's padding). */}
          <div style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} className="grid h-16 flex-1 gap-1 rounded-2xl border border-border bg-card p-1.5">
            {tabs.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[calc(var(--radius-2xl)-0.375rem)] text-[11px] font-medium transition-colors ${
                    active ? "bg-accent text-foreground" : "text-muted-foreground active:bg-accent/60 active:text-foreground"
                  }`}
                >
                  <HugeiconsIcon icon={item.icon} size={20} />
                  <span className="max-w-full truncate">{item.id === "activity" ? "Activity" : item.label}</span>
                </Link>
              );
            })}
          </div>
          <AddMenu side="top" align="end" iconSize={24} className="size-16 rounded-2xl" />
        </nav>
        </div>
        </div>
        ) : null}
      </SidebarInset>
    </SidebarProvider>
    </OpsProvider>
  );
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) {
      sessionStorage.setItem("opentill_after_login", `${window.location.pathname}${window.location.search}`);
      router.replace("/login");
    }
  }, [ready, user, router]);

  // Save every page on the device so the app opens offline. Pages a cashier can't use just redirect, so save them all.
  useEffect(() => {
    void enableOfflinePages([...new Set([...MENU_ITEMS.map((item) => item.href), ...ALWAYS_OPEN, "/reports/view", "/login"])]);
  }, []);

  if (!ready || !user) {
    return <AppShellSkeleton />;
  }

  return (
    <PosProvider userId={user.id}>
      <PosShell>{children}</PosShell>
    </PosProvider>
  );
}
