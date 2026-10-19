"use client";

import { useEffect } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { PosProvider, usePos } from "@/contexts/pos-context";
import AppSidebar, { MENU_ITEMS } from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { TenantOnboarding } from "@/components/TenantOnboarding";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

function PosShell({ children }: { children: React.ReactNode }) {
  const {
    hydrated,
    activeTenant,
    tenants,
    isSyncing,
    syncProgress,
    handleAddTenant,
    handleSwitchTenant,
  } = usePos();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!activeTenant && pathname === "/account") {
    return <div className="min-h-screen bg-background px-6">{children}</div>;
  }

  if (!activeTenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md">
          <h1 className="mb-1 text-3xl font-bold">Open your store</h1>
          <p className="mb-2 text-sm text-muted-foreground">
            Sales and products stay with the store you create.
          </p>
          <p className="mb-4 text-sm text-muted-foreground">Signed in as {user?.name}</p>
          <div className="mb-6 flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/account">Account</Link>
            </Button>
            <Button variant="ghost" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
          <TenantOnboarding
            tenants={tenants}
            activeTenant={null}
            onAddTenant={handleAddTenant}
            onSwitchTenant={handleSwitchTenant}
          />
        </div>
      </div>
    );
  }

  return (
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
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-16 md:pb-4">
          {children}
        </main>
        <nav className="fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 rounded-xl bg-card p-1 md:hidden">
          {MENU_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] ${
                  active ? "bg-accent text-foreground" : "text-muted-foreground"
                }`}
              >
                <HugeiconsIcon icon={item.icon} size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <PosProvider userId={user.id}>
      <PosShell>{children}</PosShell>
    </PosProvider>
  );
}
