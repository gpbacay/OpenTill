"use client";

import { useEffect, useMemo, useState } from "react";
import { usePos } from "@/contexts/pos-context";
import { Cashier } from "@/lib/types";
import { CASHIER_PAGES } from "@/lib/cashier-pages";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { DetailPanel, Fields, SplitView } from "@/components/data-table/DetailPanel";
import { DeleteButton } from "@/components/data-table/bulk";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { ToolbarButton, FilterBar, FilterSelect, ResetFiltersButton, SearchBox, StatTile, ViewBySelect, GroupBySelect, useGroupBy, matches, useViewMode } from "@/components/data-table/controls";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";
import { CashierDialog } from "./CashierDialog";
import { CashierInviteDialog } from "./CashierInviteDialog";
import { useCashiers, type CashierInvite } from "./use-cashiers";

/** A cashier's open app checks in every 30 seconds, so anything older than this means it is closed or offline. */
const ACTIVE_MS = 2 * 60_000;

function activity(lastSeenAt: string | null, now: number) {
  if (!lastSeenAt) return { active: false, label: "Never signed in" };
  const minutes = Math.floor((now - Date.parse(lastSeenAt)) / 60_000);
  if (now - Date.parse(lastSeenAt) < ACTIVE_MS) return { active: true, label: "Active now" };
  if (minutes < 60) return { active: false, label: `Active ${minutes}m ago` };
  if (minutes < 24 * 60) return { active: false, label: `Active ${Math.floor(minutes / 60)}h ago` };
  return { active: false, label: `Active ${Math.floor(minutes / (24 * 60))}d ago` };
}

function Activity({ lastSeenAt, now }: { lastSeenAt: string | null; now: number }) {
  const { active, label } = activity(lastSeenAt, now);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden className={`size-2 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
      <span className={active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </span>
  );
}

export function CashiersView() {
  const { tenants, handleUpdateTenant } = usePos();
  const { cashiers, error, create, update, remove, invite, resetLink } = useCashiers();
  const [query, setQuery] = useState("");
  const [store, setStore] = useState("all");
  const [view, setView] = useViewMode("cashiers", "table");
  const [groupBy, setGroupBy] = useGroupBy("cashiers");
  const [target, setTarget] = useState<Cashier | "new" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [sharing, setSharing] = useState<CashierInvite | null>(null);
  // Re-renders the "Active …" labels as time passes; new activity arrives through useCashiers' realtime refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const storeName = (id: string) => tenants.find((t) => t.id === id)?.name ?? "Unknown store";

  const rows = useMemo(
    () =>
      (cashiers ?? [])
        .filter((c) => (store === "all" || c.tenantId === store) && matches(query, c.id, c.name, c.username, storeName(c.tenantId)))
        .sort((a, b) => a.username.localeCompare(b.username)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cashiers, store, query, tenants]
  );
  const filtersActive = query.trim() !== "" || store !== "all";
  const resetFilters = () => {
    setQuery("");
    setStore("all");
    setSelectedId(null);
  };

  if (!cashiers) return <TablePageSkeleton stats={2} />;

  const deleteMany = async (chosen: Cashier[]) => {
    for (const cashier of chosen) {
      const message = await remove(cashier.id);
      if (message) {
        setActionError(message);
        return;
      }
    }
    setActionError("");
    setSelectedId((current) => (chosen.some((c) => c.id === current) ? null : current));
  };

  const shareAccess = async (cashier: Cashier) => {
    if (cashier.linkUses > 0 && !window.confirm(`Make a new link for ${cashier.username}? The old link stops working and they are signed out everywhere.`)) return;
    const { error: message, data } = await invite(cashier.id);
    setActionError(message ?? "");
    if (data) setSharing(data);
  };

  const resetUsage = async (cashier: Cashier) => {
    if (!window.confirm(`Reset the link for ${cashier.username}? The devices that used it are forgotten and they are signed out everywhere. The same link works again.`)) return;
    setActionError((await resetLink(cashier.id)) ?? "");
  };

  const columns: Column<Cashier>[] = [
    {
      id: "name",
      header: "Cashier",
      cell: (c) => (
        <div className="min-w-40">
          <p className="font-medium">{c.username}</p>
          {c.name !== c.username ? <p className="text-xs text-muted-foreground">{c.name}</p> : null}
        </div>
      ),
    },
    { id: "store", header: "Store", cell: (c) => storeName(c.tenantId) },
    {
      id: "activity",
      header: "Status",
      cell: (c) => <Activity lastSeenAt={c.lastSeenAt} now={now} />,
      group: (c) => (activity(c.lastSeenAt, now).active ? "Active now" : c.lastSeenAt ? "Away" : "Never signed in"),
    },
    { id: "created", header: "Added", cell: (c) => new Date(c.createdAt).toLocaleDateString() },
  ];

  const selected = cashiers.find((c) => c.id === selectedId) ?? null;
  const panel = selected ? (
    <DetailPanel
      title={selected.username}
      subtitle={selected.name !== selected.username ? selected.name : undefined}
      onClose={() => setSelectedId(null)}
      actions={
        <>
          <Button onClick={() => void shareAccess(selected)}>Share access</Button>
          {selected.linkUses > 0 ? (
            <Button variant="secondary" onClick={() => void resetUsage(selected)}>Reset link usage</Button>
          ) : null}
          <Button variant="secondary" onClick={() => setTarget(selected)}>Edit</Button>
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (window.confirm(`Delete ${selected.username}? They will be signed out and can no longer log in.`)) void deleteMany([selected]);
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      <Fields
        rows={[
          ["Status", <Activity key="status" lastSeenAt={selected.lastSeenAt} now={now} />],
          ["Store", storeName(selected.tenantId)],
          ["Pages", ["Register", ...CASHIER_PAGES.filter((page) => selected.pages.includes(page.href)).map((page) => page.label)].join(", ")],
          ["Sign-in link", selected.hasLink ? `${selected.linkUses} of ${selected.linkMaxUses} device${selected.linkMaxUses === 1 ? "" : "s"} used` : "None"],
          ["Added", new Date(selected.createdAt).toLocaleDateString()],
        ]}
      />
    </DetailPanel>
  ) : null;

  const shownError = actionError || error;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SplitView panel={panel}>
        <div className="hidden shrink-0 grid-cols-2 gap-3 sm:grid">
          <StatTile label="Cashiers" value={cashiers.length} />
          <StatTile label="Stores with a cashier" value={new Set(cashiers.map((c) => c.tenantId)).size} />
        </div>
        <FilterBar active={filtersActive} actions={<ToolbarButton icon={PlusSignIcon} label="Add cashier" short="Add" onClick={() => setTarget("new")} />}>
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, username…" />
          <FilterSelect label="Store" value={store} onChange={setStore} options={[{ value: "all", label: "All stores" }, ...tenants.map((t) => ({ value: t.id, label: t.name }))]} />
          <ViewBySelect value={view} onChange={setView} />
          <GroupBySelect columns={columns} value={groupBy} onChange={setGroupBy} />
          {filtersActive ? <ResetFiltersButton onClick={resetFilters} /> : null}
        </FilterBar>
        {shownError ? (
          <p role="alert" className="shrink-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{shownError}</p>
        ) : null}
        <DataTable
          rows={rows}
          columns={columns}
            groupBy={groupBy}
          rowKey={(c) => c.id}
          view={view}
          cardValue="store"
          onRowClick={(c, checked) => setSelectedId((current) => (checked ? c.id : current === c.id ? null : current))}
          selectedKey={selectedId}
          bulkActions={(chosen, clear) => (
            <DeleteButton
              count={chosen.length}
              noun="cashier"
              onConfirm={() => {
                void deleteMany(chosen);
                clear();
              }}
            />
          )}
          resetKey={`${query}|${store}`}
          empty={cashiers.length === 0 ? "No cashiers yet. Add one so staff can ring up sales without seeing the rest of your business." : "Nothing matches those filters."}
        />
      </SplitView>
      <CashierDialog
        target={target}
        onClose={() => setTarget(null)}
        onSave={async (id, input) => {
          // Stores are kept on the device first and uploaded in the background. A cashier needs the store on the
          // server, so send it now (saving by id is safe to repeat).
          const store = tenants.find((t) => t.id === input.tenantId);
          if (store) await handleUpdateTenant(store);
          if (id) return update(id, input);
          const { error: message, data } = await create(input);
          if (data) setSharing(data);
          return message;
        }}
      />
      <CashierInviteDialog invite={sharing} onClose={() => setSharing(null)} />
    </div>
  );
}
