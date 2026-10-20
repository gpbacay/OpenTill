"use client";

import { useState } from "react";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import type { CustomColumn, CustomColumnTable } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Column } from "./DataTable";

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
          <Input
            id={`custom-${column.id}`}
            type={column.type === "text" ? "text" : column.type}
            step={column.type === "number" ? "any" : undefined}
            value={values[column.id] ?? ""}
            onChange={(event) => onChange({ ...values, [column.id]: event.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

/** "Columns" button: add and remove the user's extra columns for one table. */
export function ColumnManager({ table }: { table: CustomColumnTable }) {
  const { activeTenant } = usePos();
  const { columnsFor, saveColumn, deleteColumn } = useOps();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomColumn["type"]>("text");
  const [error, setError] = useState("");
  if (!activeTenant) return null;
  const columns = columnsFor(table);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const name = label.trim();
    if (!name) return;
    if (columns.some((column) => column.label.toLowerCase() === name.toLowerCase())) {
      setError(`There is already a "${name}" column.`);
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
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Columns{columns.length > 0 ? ` (${columns.length})` : ""}
      </Button>
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
            {columns.map((column) => (
              <li key={column.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
                <span className="text-sm">
                  {column.label} <span className="text-xs text-muted-foreground">{column.type}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Remove the "${column.label}" column? Its values are hidden but kept.`)) deleteColumn(column.id);
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
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
