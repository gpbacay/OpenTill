"use client";

import { useState, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { isCashier } from "@/lib/local-auth";
import type { CustomColumn, CustomColumnTable } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Delete02Icon, InformationCircleIcon, LayoutThreeColumnIcon, PencilEdit02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { Column } from "./DataTable";
import { ToolbarButton } from "./controls";

type WithCustom = { custom?: Record<string, string> };

function formatValue(column: CustomColumn, raw: string | undefined) {
  if (!raw) return <span className="text-muted-foreground">—</span>;
  if (column.type === "number") return Number(raw).toLocaleString("en-US");
  if (column.type === "date") return new Date(raw).toLocaleDateString();
  return raw;
}

type ColumnPref = { label?: string; hidden?: true };

const prefListeners = new Set<() => void>();

function readPrefs(key: string) {
  if (!key) return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writePrefs(key: string, prefs: Record<string, ColumnPref>) {
  const kept = Object.fromEntries(Object.entries(prefs).filter(([, pref]) => pref.label || pref.hidden));
  try {
    if (Object.keys(kept).length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(kept));
  } catch {}
  prefListeners.forEach((listener) => listener());
}

/** Renames and removals for the table's own columns, on this device. Custom columns are stored with the store instead. */
export function useColumnPrefs(tenantId: string | undefined, table: string) {
  const key = tenantId ? `opentill_column_prefs_${tenantId}_${table}` : "";
  const raw = useSyncExternalStore(
    (listener) => {
      prefListeners.add(listener);
      return () => prefListeners.delete(listener);
    },
    () => readPrefs(key),
    () => ""
  );
  const change = (id: string, pref: ColumnPref) => {
    if (!key) return;
    let prefs: Record<string, ColumnPref> = {};
    try {
      prefs = raw ? (JSON.parse(raw) as Record<string, ColumnPref>) : {};
    } catch {
      prefs = {};
    }
    const next = { ...prefs[id], ...pref };
    if (!next.label) delete next.label;
    if (!next.hidden) delete next.hidden;
    if (next.label || next.hidden) prefs[id] = next;
    else delete prefs[id];
    writePrefs(key, prefs);
  };
  return {
    raw,
    rename: (id: string, label: string) => change(id, { label }),
    hide: (id: string) => change(id, { hidden: true }),
  };
}

/** Apply saved names and drop columns removed from this table. */
export function applyColumnPrefs<T>(columns: Column<T>[], raw: string): Column<T>[] {
  if (!raw) return columns;
  let prefs: Record<string, ColumnPref> = {};
  try {
    prefs = JSON.parse(raw) as Record<string, ColumnPref>;
  } catch {
    return columns;
  }
  return columns.flatMap((column) => {
    const pref = prefs[column.id];
    if (!pref) return [column];
    if (pref.hidden) return [];
    return pref.label ? [{ ...column, header: pref.label }] : [column];
  });
}

/** Table columns for the user's own fields. Append them after the table's own columns. */
export function customColumnDefs<T extends WithCustom>(columns: CustomColumn[]): Column<T>[] {
  return columns.map((column) => ({
    id: `custom-${column.id}`,
    header: column.label,
    align: column.type === "number" ? "right" : undefined,
    cell: (row) => formatValue(column, row.custom?.[column.id]),
  }));
}

/** One detail-panel row for a column that is still on the table, using its current name. */
export function columnField<T>(columns: Pick<Column<T>, "id" | "header">[], id: string, value: React.ReactNode): [string, React.ReactNode][] {
  const column = columns.find((item) => item.id === id);
  return column ? [[column.header, value]] : [];
}

/** [label, formatted value] for each of the user's columns, for detail panels. */
export const customFieldRows = (columns: CustomColumn[], custom?: Record<string, string>): [string, React.ReactNode][] =>
  columns.map((column) => [column.label, formatValue(column, custom?.[column.id])]);

/** Searchable text for a row's custom values. */
export const customText = (row: WithCustom) => Object.values(row.custom ?? {}).join(" ");

/** One input per custom column, for use inside add/edit dialogs. */
export function CustomFieldInputs({
  columns,
  values,
  onChange,
}: {
  columns: CustomColumn[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  if (columns.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {columns.map((column) => (
        <div key={column.id} className="space-y-1">
          <Label htmlFor={`custom-${column.id}`}>{column.label}</Label>
          {column.type === "number" ? (
            <NumberInput
              id={`custom-${column.id}`}
              negative
              value={values[column.id] ?? ""}
              onChange={(event) => onChange({ ...values, [column.id]: event.target.value })}
            />
          ) : (
            <Input
              id={`custom-${column.id}`}
              type={column.type}
              value={values[column.id] ?? ""}
              onChange={(event) => onChange({ ...values, [column.id]: event.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const COLUMN_HELP = "Add your own fields to this table, like Brand or Shelf. They show up in the table, the add/edit form and search.";

/** "Columns" button: add, rename and remove the user's extra columns for one table. Setting them up is the admin's job. */
export function ColumnManager<T>({ table, columns: tableColumns }: { table: CustomColumnTable; columns: Pick<Column<T>, "id" | "header" | "align" | "type">[] }) {
  return isCashier(useAuth().user) ? null : <ColumnEditor table={table} tableColumns={tableColumns} />;
}

function columnDataType(column: { id: string; align?: "right"; type?: "text" | "number" | "date" }): "text" | "number" | "date" {
  if (column.type) return column.type;
  return column.align === "right" ? "number" : "text";
}

function ColumnEditor<T>({ table, tableColumns }: { table: CustomColumnTable; tableColumns: Pick<Column<T>, "id" | "header" | "align" | "type">[] }) {
  const { activeTenant } = usePos();
  const { columnsFor, saveColumn, deleteColumn } = useOps();
  const prefs = useColumnPrefs(activeTenant?.id, table);
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomColumn["type"]>("text");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (!activeTenant) return null;
  const columns = columnsFor(table);
  const builtIn = tableColumns.filter((column) => !column.id.startsWith("custom-"));

  const listed = [
    ...builtIn.map((column) => ({ id: column.id, label: column.header, type: columnDataType(column) })),
    ...columns.map((column) => ({ id: column.id, label: column.label, type: column.type })),
  ];

  /** Error when another column already has this name, else "". */
  const clash = (name: string, except?: string) =>
    listed.some((column) => column.id !== except && column.label.toLowerCase() === name.toLowerCase())
      ? `There is already a "${name}" column.`
      : "";

  const startEdit = (id: string, name: string) => {
    setEditing(id);
    setDraft(name);
    setError("");
  };

  const rename = (event: React.FormEvent, id: string, current: string) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const problem = clash(name, id);
    setError(problem);
    if (problem) return;
    if (name !== current) {
      const custom = columns.find((column) => column.id === id);
      // Values are stored by column id, so renaming keeps them.
      if (custom) saveColumn({ ...custom, label: name });
      else prefs.rename(id, name);
    }
    setEditing(null);
  };

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const name = label.trim();
    if (!name) return;
    const problem = clash(name);
    if (problem) {
      setError(problem);
      return;
    }
    saveColumn({
      id: `col-${Date.now()}`,
      tenantId: activeTenant.id,
      tableName: table,
      label: name,
      type,
      createdAt: new Date().toISOString(),
    });
    setLabel("");
    setError("");
  };

  return (
    <>
      <ToolbarButton variant="secondary" icon={LayoutThreeColumnIcon} label="Columns" count={columns.length} onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              Your columns
              {/* Controlled so a tap opens it on phones, where there is no hover. */}
              <Tooltip open={help} onOpenChange={setHelp}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About your columns"
                    className="-m-1 rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => setHelp((open) => !open)}
                    onBlur={() => setHelp(false)}
                  >
                    <HugeiconsIcon icon={InformationCircleIcon} size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="z-[60] block text-left">
                  {COLUMN_HELP}
                </TooltipContent>
              </Tooltip>
            </DialogTitle>
            <DialogDescription className="sr-only">{COLUMN_HELP}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1">
            {listed.length === 0 ? <li className="text-sm text-muted-foreground">No columns yet.</li> : null}
            {listed.map((column) =>
              editing === column.id ? (
                <li key={column.id}>
                  <form onSubmit={(event) => rename(event, column.id, column.label)} className="flex items-center gap-1 rounded-md bg-accent px-2 py-1">
                    <Input
                      autoFocus
                      aria-label={`New name for ${column.label}`}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        // Escape cancels the rename instead of closing the dialog.
                        if (event.key === "Escape") {
                          event.stopPropagation();
                          setEditing(null);
                          setError("");
                        }
                      }}
                      maxLength={40}
                      className="h-7 min-w-0 flex-1"
                    />
                    <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save name" title="Save name" disabled={!draft.trim()}>
                      <HugeiconsIcon icon={Tick02Icon} size={16} />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Cancel"
                      title="Cancel"
                      onClick={() => {
                        setEditing(null);
                        setError("");
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} />
                    </Button>
                  </form>
                </li>
              ) : (
                <li key={column.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-accent">
                  <span className="min-w-0 truncate text-sm">
                    {column.label} {column.type ? <span className="text-xs text-muted-foreground">{column.type}</span> : null}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Rename ${column.label}`}
                      title="Rename"
                      onClick={() => startEdit(column.id, column.label)}
                    >
                      <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive"
                      aria-label={`Remove ${column.label}`}
                      title="Remove"
                      onClick={() => {
                        if (!window.confirm(`Remove the "${column.label}" column? Its values are hidden but kept.`)) return;
                        if (columns.some((custom) => custom.id === column.id)) deleteColumn(column.id);
                        else prefs.hide(column.id);
                      }}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} />
                    </Button>
                  </span>
                </li>
              )
            )}
          </ul>
          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="new-column-label">New column</Label>
              <Input id="new-column-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Brand" maxLength={40} />
            </div>
            <select
              aria-label="Column type"
              value={type}
              onChange={(event) => setType(event.target.value as CustomColumn["type"])}
              className="h-8 rounded-lg bg-input px-2 text-sm"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
            <Button type="submit" disabled={!label.trim()}>
              Add
            </Button>
          </form>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
