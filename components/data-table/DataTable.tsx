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
  /** Change this when search/filters change so the table jumps back to page 1. */
  resetKey?: string;
  pageSizes?: number[];
}

/** Sticky-header table with built-in pagination. Rows arrive already searched and filtered. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  resetKey,
  pageSizes = [10, 25, 50],
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizes[0]);

  useEffect(() => setPage(1), [resetKey, pageSize]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`sticky top-0 whitespace-nowrap bg-card px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-[0_1px_0_var(--input)] ${
                    column.align === "right" ? "text-right" : "text-left"
                  } z-10`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-16 text-center text-sm text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  aria-selected={selectedKey === rowKey(row)}
                  className={`hover:bg-accent/60 aria-selected:bg-accent ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`px-3 py-2.5 align-middle ${column.align === "right" ? "text-right tabular-nums" : ""} ${column.className ?? ""}`}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
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
