"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
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
  /** Clicking a row also ticks (or unticks) its checkbox; `checked` is the new state. */
  onRowClick?: (row: T, checked: boolean) => void;
  /** Row whose detail panel is open. */
  selectedKey?: string | null;
  empty: ReactNode;
  /** Change this when search/filters change so the table jumps back to page 1 and clears the selection. */
  resetKey?: string;
  pageSizes?: number[];
  /** Row checkboxes with a selection bar. On by default. */
  selectable?: boolean;
  /** Prevent selection and row actions for rows that cannot be acted on. */
  isRowDisabled?: (row: T) => boolean;
  /** Buttons for the selection bar, given the chosen rows and a function that clears the selection. */
  bulkActions?: (chosen: T[], clear: () => void) => ReactNode;
}

// Row checkboxes stay hidden until the row is hovered or focused, or something is already selected (always shown on
// touch screens). The select-all checkbox in the header is always visible so a selection can always be undone.
const REVEAL = "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100";

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
  isRowDisabled,
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

  const available = rows.filter((row) => !isRowDisabled?.(row));
  const availableOnPage = visible.filter((row) => !isRowDisabled?.(row));
  // Only actionable rows still in the table count, so filtering or disabling a row never exposes a stale selection.
  const chosen = available.filter((row) => picked.has(rowKey(row)));
  const anyChosen = chosen.length > 0;
  const pageChosen = availableOnPage.filter((row) => picked.has(rowKey(row))).length;
  const clear = () => setPicked(new Set());

  const toggle = (row: T) => {
    if (isRowDisabled?.(row)) return;
    setPicked((prev) => {
      const next = new Set(prev);
      const key = rowKey(row);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePage = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      const all = availableOnPage.length > 0 && pageChosen === availableOnPage.length;
      availableOnPage.forEach((row) => (all ? next.delete(rowKey(row)) : next.add(rowKey(row))));
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card">
      {anyChosen ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 bg-accent px-3 py-2 text-sm">
          <span className="font-medium">{chosen.length} selected</span>
          {chosen.length < available.length ? (
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(available.map(rowKey)))}>
              Select all {available.length}
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
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {selectable ? (
                <th scope="col" className="sticky top-0 z-10 w-10 bg-card py-2.5 pl-3 text-left align-middle shadow-[0_1px_0_var(--input)]">
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    className="block size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                    checked={availableOnPage.length > 0 && pageChosen === availableOnPage.length}
                    disabled={availableOnPage.length === 0}
                    ref={(el) => {
                      if (el) el.indeterminate = pageChosen > 0 && pageChosen < availableOnPage.length;
                    }}
                    onChange={togglePage}
                  />
                </th>
              ) : null}
              <th
                scope="col"
                className="sticky top-0 z-10 whitespace-nowrap bg-card px-3 py-2.5 text-left text-xs font-medium text-muted-foreground shadow-[0_1px_0_var(--input)]"
              >
                ID
              </th>
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
                <td colSpan={columns.length + (selectable ? 2 : 1)} className="px-3 py-16 text-center text-sm text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const key = rowKey(row);
                const disabled = isRowDisabled?.(row) ?? false;
                const checked = !disabled && picked.has(key);
                const interactive = !disabled && (selectable || Boolean(onRowClick));
                return (
                  <tr
                    key={key}
                    onClick={
                      interactive
                        ? () => {
                            if (selectable) toggle(row);
                            onRowClick?.(row, selectable ? !checked : false);
                          }
                        : undefined
                    }
                    aria-selected={selectedKey === key}
                    aria-disabled={disabled || undefined}
                    data-checked={checked}
                    className={`group/row aria-selected:bg-accent data-[checked=true]:bg-accent/70 ${
                      interactive ? "cursor-pointer hover:bg-accent/60" : ""
                    } ${disabled ? "opacity-50" : ""}`}
                  >
                    {selectable ? (
                      <td className="w-10 py-2.5 pl-3 text-left align-middle">
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          className={`block size-4 cursor-pointer accent-primary disabled:cursor-not-allowed ${anyChosen || checked ? "opacity-100" : REVEAL}`}
                          checked={checked}
                          disabled={disabled}
                          readOnly
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 align-middle">
                      <span title={key} className="select-all whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {key}
                      </span>
                    </td>
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
          <label className="flex items-center gap-1.5">
            <span>Rows</span>
            <span className="relative">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-7 appearance-none rounded-md bg-input py-0 pr-8 pl-2.5 text-foreground"
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={14}
                className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
              />
            </span>
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
