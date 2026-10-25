"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useAuth } from "@/contexts/auth-context";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { useRealtimeStatus } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchBox, matches } from "@/components/data-table/controls";
import { CategoryManager } from "@/components/settings/CategoryManager";

interface Setting {
  id: string;
  section: string;
  title: string;
  description: string;
  /** Extra words people might search for. */
  keywords?: string;
  /** Id of the row's switch, so the title toggles it too. */
  labelFor?: string;
  /** Control on the right of the row. */
  control?: ReactNode;
  /** Full-width content under the row. */
  body?: ReactNode;
}

const SECTIONS = ["Appearance", "Stores", "Products", "Data and sync", "Account", "Help and info"];

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild size="sm" variant="secondary">
      <Link href={href}>
        {label}
        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
      </Link>
    </Button>
  );
}

export default function SettingsPage() {
  const {
    tenants,
    activeTenant,
    isDarkMode,
    setIsDarkMode,
    autoHideNav,
    setAutoHideNav,
    isOnline,
    isSyncing,
    offlineQueue,
    triggerOfflineSync,
  } = usePos();
  const { pending } = useOps();
  const { user } = useAuth();
  const status = useRealtimeStatus();
  const [query, setQuery] = useState("");
  const queued = offlineQueue.filter((entry) => entry.order.tenantId === activeTenant?.id).length;

  const settings: Setting[] = [
    {
      id: "theme",
      section: "Appearance",
      title: "Dark theme",
      description: "Use light text on a dark background. Saved on this device.",
      keywords: "light mode dark mode colors appearance",
      labelFor: "dark-theme",
      control: <Switch id="dark-theme" checked={isDarkMode} onCheckedChange={(checked) => setIsDarkMode(checked)} />,
    },
    {
      id: "bottom-bar",
      section: "Appearance",
      title: "Auto-hide bottom bar",
      description: "On phones, hide the bottom bar after a few seconds. Touch or scroll the screen to bring it back. Saved on this device.",
      keywords: "navigation nav bar tabs hide show phone mobile",
      labelFor: "auto-hide-nav",
      control: <Switch id="auto-hide-nav" checked={autoHideNav} onCheckedChange={setAutoHideNav} />,
    },
    {
      id: "stores",
      section: "Stores",
      title: "Your stores",
      description: `You have ${tenants.length} ${tenants.length === 1 ? "store" : "stores"} and you're working in ${activeTenant?.name ?? "none"}. Add, edit, switch or delete stores.`,
      keywords: "tenant switch store create store branch currency business tax delete",
      control: <LinkRow href="/stores" label="Manage stores" />,
    },
    {
      id: "cashiers",
      section: "Stores",
      title: "Cashier accounts",
      description: "Give staff their own login that can only use the Register of one store.",
      keywords: "cashier staff employee team user login role permission access",
      control: <LinkRow href="/cashiers" label="Manage cashiers" />,
    },
    {
      id: "categories",
      section: "Products",
      title: "Product categories",
      description: `The categories you can pick when adding a product${activeTenant ? ` in ${activeTenant.name}` : ""}.`,
      keywords: "category categories group type product kinds organize",
      body: <CategoryManager />,
    },
    {
      id: "connection",
      section: "Data and sync",
      title: "Connection",
      description: !isOnline
        ? "Offline. Changes are saved on this device and sent when you're back online."
        : status === "live"
          ? "Online. Changes from other devices show up instantly."
          : "Online. Live updates are unavailable, so the app checks for changes every few seconds.",
      keywords: "online offline internet realtime live polling network",
      control: (
        <span className={`size-2.5 rounded-full ${!isOnline ? "bg-destructive" : status === "live" ? "bg-primary" : "bg-amber-400"}`} />
      ),
    },
    {
      id: "queue",
      section: "Data and sync",
      title: "Unsaved changes",
      description:
        queued + pending === 0
          ? "Everything on this device is saved."
          : `${queued} ${queued === 1 ? "sale" : "sales"} and ${pending} other ${pending === 1 ? "change" : "changes"} are waiting to be sent.`,
      keywords: "sync queue pending outbox upload save backup",
      control:
        queued > 0 ? (
          <Button size="sm" variant="secondary" disabled={isSyncing || !isOnline} onClick={() => void triggerOfflineSync()}>
            {isSyncing ? "Saving" : "Save now"}
          </Button>
        ) : null,
    },
    {
      id: "account",
      section: "Account",
      title: "Profile and password",
      description: `Signed in as ${user?.username ?? ""}. Change your name, photo, username or password.`,
      keywords: "profile picture photo avatar name username password sign out log out",
      control: <LinkRow href="/account" label="Account" />,
    },
    {
      id: "help",
      section: "Help and info",
      title: "Help center",
      description: "How-to guides and answers to common questions.",
      keywords: "faq support guide how to questions",
      control: <LinkRow href="/help" label="Open" />,
    },
    {
      id: "about",
      section: "Help and info",
      title: "About OpenTill",
      description: "What OpenTill is, how your data is stored and the version you're using.",
      keywords: "version info privacy",
      control: <LinkRow href="/about" label="Open" />,
    },
  ];

  const shown = settings.filter((s) => matches(query, s.title, s.description, s.section, s.keywords));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <SearchBox value={query} onChange={setQuery} placeholder="Search settings…" className="w-full" />
        {shown.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No settings match “{query.trim()}”.</p>
        ) : (
          SECTIONS.map((section) => {
            const rows = shown.filter((s) => s.section === section);
            if (rows.length === 0) return null;
            return (
              <section key={section} className="space-y-2">
                <h2 className="px-1 text-xs font-medium text-muted-foreground">{section}</h2>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {rows.map((s) => (
                    <div key={s.id} className="space-y-4 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          {s.labelFor ? (
                            <Label htmlFor={s.labelFor} className="text-sm font-medium">
                              {s.title}
                            </Label>
                          ) : (
                            <p className="text-sm font-medium">{s.title}</p>
                          )}
                          <p className="text-sm text-muted-foreground">{s.description}</p>
                        </div>
                        {s.control ? <div className="shrink-0">{s.control}</div> : null}
                      </div>
                      {s.body}
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
