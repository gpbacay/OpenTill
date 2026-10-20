"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Row whose detail panel is open. */
  selectedKey?: string | null;
  empty: ReactNode;
  /** Change this when search/filters change so the table jumps back to page 1 and clears the selection. */
  resetKey?: string;
  pageSizes?: number[];
  /** Row checkboxes with a selection bar. On by default. */
  selectable?: boolean;
  /** Buttons for the selection bar, given the chosen rows and a function that clears the selection. */
  bulkActions?: (chosen: T[], clear: () => void) => ReactNode;
}

// Hidden until the row is hovered or focused, or something is already selected. Always shown on touch screens.
const REVEAL = "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100";
const REVEAL_HEAD = "opacity-0 group-hover/table:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100";

/** Sticky-header table with pagination and row selection. Rows arrive already searched and filtered. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  resetKey,
  pageSizes = [10, 25, 50],
  selectable = true,
  bulkActions,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => setPage(1), [resetKey, pageSize]);
  useEffect(() => setPicked(new Set()), [resetKey]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);

  // Only rows still in the table count, so deleting or filtering rows never leaves a stale selection behind.
  const chosen = rows.filter((row) => picked.has(rowKey(row)));
  const anyChosen = chosen.length > 0;
  const pageChosen = visible.filter((row) => picked.has(rowKey(row))).length;
  const clear = () => setPicked(new Set());

  const toggle = (row: T) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const key = rowKey(row);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const togglePage = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      const all = visible.length > 0 && pageChosen === visible.length;
      visible.forEach((row) => (all ? next.delete(rowKey(row)) : next.add(rowKey(row))));
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card">
      {anyChosen ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 bg-accent px-3 py-2 text-sm">
          <span className="font-medium">{chosen.length} selected</span>
          {chosen.length < rows.length ? (
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(rows.map(rowKey)))}>
              Select all {rows.length}
            </Button>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkActions?.(chosen, clear)}
            <Button size="sm" variant="ghost" onClick={clear}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}
      <div className="group/table min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {selectable ? (
                <th scope="col" className="sticky top-0 z-10 w-10 bg-card py-2.5 pl-3 shadow-[0_1px_0_var(--input)]">
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    className={`size-4 cursor-pointer accent-primary ${anyChosen ? "opacity-100" : REVEAL_HEAD}`}
                    checked={visible.length > 0 && pageChosen === visible.length}
                    ref={(el) => {
                      if (el) el.indeterminate = pageChosen > 0 && pageChosen < visible.length;
                    }}
                    onChange={togglePage}
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`sticky top-0 z-10 whitespace-nowrap bg-card px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-[0_1px_0_var(--input)] ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-16 text-center text-sm text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const key = rowKey(row);
                const checked = picked.has(key);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    aria-selected={selectedKey === key}
                    data-checked={checked}
                    className={`group/row hover:bg-accent/60 aria-selected:bg-accent data-[checked=true]:bg-accent/70 ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    {selectable ? (
                      <td className="w-10 py-2.5 pl-3 align-middle" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          className={`size-4 cursor-pointer accent-primary ${anyChosen || checked ? "opacity-100" : REVEAL}`}
                          checked={checked}
                          onChange={() => toggle(row)}
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={`px-3 py-2.5 align-middle ${column.align === "right" ? "text-right tabular-nums" : ""} ${column.className ?? ""}`}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground shadow-[0_-1px_0_var(--input)]">
        <span>
          {rows.length === 0 ? "0 results" : `${start + 1}–${start + visible.length} of ${rows.length}`}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Rows
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-7 rounded-md bg-input px-1.5 text-foreground"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            Prev
          </Button>
          <span className="tabular-nums">
            {current} / {pageCount}
          </span>
          <Button size="sm" variant="secondary" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
