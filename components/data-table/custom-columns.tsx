"use client";

import { useState } from "react";
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
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Delete02Icon, LayoutThreeColumnIcon, PencilEdit02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { Column } from "./DataTable";
import { ToolbarButton } from "./controls";

type WithCustom = { custom?: Record<string, string> };

function formatValue(column: CustomColumn, raw: string | undefined) {
  if (!raw) return <span className="text-muted-foreground">—</span>;
  if (column.type === "number") return Number(raw).toLocaleString("en-US");
  if (column.type === "date") return new Date(raw).toLocaleDateString();
  return raw;
}

/** Table columns for the user's own fields. Append them after the built-in ones. */
export function customColumnDefs<T extends WithCustom>(columns: CustomColumn[]): Column<T>[] {
  return columns.map((column) => ({
    id: `custom-${column.id}`,
    header: column.label,
    align: column.type === "number" ? "right" : undefined,
    cell: (row) => formatValue(column, row.custom?.[column.id]),
  }));
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

/** "Columns" button: add, rename and remove the user's extra columns for one table. Setting them up is the admin's job. */
export function ColumnManager({ table }: { table: CustomColumnTable }) {
  return isCashier(useAuth().user) ? null : <ColumnEditor table={table} />;
}

function ColumnEditor({ table }: { table: CustomColumnTable }) {
  const { activeTenant } = usePos();
  const { columnsFor, saveColumn, deleteColumn } = useOps();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomColumn["type"]>("text");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (!activeTenant) return null;
  const columns = columnsFor(table);

  /** Error when another column already has this name, else "". */
  const clash = (name: string, except?: string) =>
    columns.some((column) => column.id !== except && column.label.toLowerCase() === name.toLowerCase())
      ? `There is already a "${name}" column.`
      : "";

  const startEdit = (column: CustomColumn) => {
    setEditing(column.id);
    setDraft(column.label);
    setError("");
  };

  const rename = (event: React.FormEvent, column: CustomColumn) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const problem = clash(name, column.id);
    setError(problem);
    if (problem) return;
    // Values are stored by column id, so renaming keeps them.
    if (name !== column.label) saveColumn({ ...column, label: name });
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
            <DialogTitle>Your columns</DialogTitle>
            <DialogDescription>
              Add your own fields to this table, like Brand or Shelf. They show up in the table, the add/edit form and search.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1">
            {columns.length === 0 ? <li className="text-sm text-muted-foreground">No custom columns yet.</li> : null}
            {columns.map((column) =>
              editing === column.id ? (
                <li key={column.id}>
                  <form onSubmit={(event) => rename(event, column)} className="flex items-center gap-1 rounded-md bg-accent px-2 py-1">
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
                    {column.label} <span className="text-xs text-muted-foreground">{column.type}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Rename ${column.label}`}
                      title="Rename"
                      onClick={() => startEdit(column)}
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
                        if (window.confirm(`Remove the "${column.label}" column? Its values are hidden but kept.`)) deleteColumn(column.id);
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
