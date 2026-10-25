"use client";

import { Fragment, isValidElement, useEffect, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Image01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  className?: string;
  /** Group label when rows are grouped by this column. Defaults to the cell's text, with groups sorted A–Z; when given, groups keep the rows' order (e.g. newest day first). */
  group?: (row: T) => string;
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
  /** Table rows, or cards (first column as the heading, the rest as labelled fields). */
  view?: "table" | "cards";
  /** Column used as a card's heading. Defaults to the first column. */
  cardTitle?: string;
  /** Column shown large under a card's heading (e.g. price or total). */
  cardValue?: string;
  /** Lets people drag table headers to reorder columns, remembered on this device under this key. */
  columnOrderKey?: string;
  /** Column id to group rows under collapsible headers. Ignored when no column has this id. */
  groupBy?: string;
  /** Row photo: a cover on cards and a thumbnail in the table. Return "" or undefined for a placeholder. */
  image?: (row: T) => string | undefined;
}

// Row checkboxes stay hidden until the row is hovered or focused, or something is already selected (always shown on
// touch screens). The select-all checkbox in the header is always visible so a selection can always be undone.
const REVEAL = "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100";

/** Column order saved on this device. Columns not in the saved order (e.g. newly added custom ones) go last. */
function useColumnOrder<T>(columns: Column<T>[], key?: string) {
  const storageKey = `opentill_columns_${key}`;
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    if (!key) return;
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(raw)) setSaved(raw);
    } catch {}
  }, [key, storageKey]);

  const rank = (id: string) => (saved.includes(id) ? saved.indexOf(id) : Infinity);
  const ordered = key ? [...columns].sort((a, b) => rank(a.id) - rank(b.id)) : columns;

  const move = (id: string, to: number) => {
    const ids = ordered.map((column) => column.id).filter((other) => other !== id);
    ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id);
    setSaved(ids);
    try {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    } catch {}
  };
  return [ordered, move] as const;
}

/** Plain text of a rendered cell, so any column can group rows. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).filter(Boolean).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

type Group<T> = { key: string | null; rows: T[] };
type Section<T> = Group<T> & { count: number };

function groupRows<T>(rows: T[], column?: Column<T>): Group<T>[] {
  if (!column) return [{ key: null, rows }];
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = (column.group?.(row) ?? textOf(column.cell(row))).trim() || "—";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const list = [...groups].map(([key, rows]) => ({ key, rows }));
  return column.group ? list : list.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

/**
 * Pages of at most `size` rows. Groups are closed unless their key is in `opened`; a closed group keeps its header but no
 * rows, and a group cut by a page break repeats its header on the next page. Ungrouped rows are one group with a null
 * key (no header, always open).
 */
export function paginate<T>(groups: Group<T>[], opened: Set<string>, size: number): Section<T>[][] {
  const pages: Section<T>[][] = [[]];
  let n = 0;
  for (const group of groups) {
    const open = group.key === null || opened.has(group.key);
    if (open && group.rows.length && n === size) {
      pages.push([]);
      n = 0;
    }
    let section: Section<T> = { key: group.key, count: group.rows.length, rows: [] };
    pages[pages.length - 1].push(section);
    if (!open) continue;
    for (const row of group.rows) {
      if (n === size) {
        section = { ...section, rows: [] };
        pages.push([section]);
        n = 0;
      }
      section.rows.push(row);
      n++;
    }
  }
  return pages;
}

/** Sticky-header table (or card grid) with pagination and row selection. Rows arrive already searched and filtered. */
export function DataTable<T>({
  rows,
  columns: givenColumns,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  resetKey,
  pageSizes = [10, 25, 50, 100],
  selectable = true,
  isRowDisabled,
  bulkActions,
  view = "table",
  cardTitle,
  cardValue,
  columnOrderKey,
  groupBy,
  image,
}: DataTableProps<T>) {
  const [ordered, moveColumn] = useColumnOrder(givenColumns, columnOrderKey);
  const [dragging, setDragging] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizes[pageSizes.length - 1]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<Set<string>>(new Set());

  useEffect(() => setPage(1), [resetKey, pageSize, groupBy]);
  useEffect(() => setPicked(new Set()), [resetKey]);
  useEffect(() => setOpened(new Set()), [groupBy]);

  const groupColumn = ordered.find((column) => column.id === groupBy);
  // The grouped column's value is already in each group header.
  const columns = ordered.filter((column) => column !== groupColumn);
  const groups = groupRows(rows, groupColumn);
  // Grouped rows show all at once: closed groups already keep the list short.
  const pages = paginate(groups, opened, groupColumn ? Infinity : pageSize);
  const pageCount = pages.length;
  const current = Math.min(page, pageCount);
  const sections = pages[current - 1];
  const visible = sections.flatMap((section) => section.rows);
  const start = pages.slice(0, current - 1).flat().reduce((sum, section) => sum + section.rows.length, 0);
  const shown = pages.flat().reduce((sum, section) => sum + section.rows.length, 0);

  const toggleGroup = (key: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groupHeader = (section: Section<T>) => {
    if (section.key === null || !groupColumn) return null;
    const open = opened.has(section.key);
    return (
      <button
        type="button"
        aria-expanded={open}
        onClick={() => toggleGroup(section.key!)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-accent/60"
      >
        <HugeiconsIcon icon={ArrowDown01Icon} size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="sr-only">{groupColumn.header}</span>
        <span className="truncate text-foreground">{section.key}</span>
        <span className="ml-auto rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground">{section.count}</span>
      </button>
    );
  };

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

  const pageCheckbox = (
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
  );

  /** Click handling, selection state and checkbox shared by table rows and cards. */
  const rowState = (row: T) => {
    const key = rowKey(row);
    const disabled = isRowDisabled?.(row) ?? false;
    const checked = !disabled && picked.has(key);
    const interactive = !disabled && (selectable || Boolean(onRowClick));
    return {
      key,
      interactive,
      props: {
        onClick: interactive
          ? () => {
              if (selectable) toggle(row);
              onRowClick?.(row, selectable ? !checked : false);
            }
          : undefined,
        "aria-selected": selectedKey === key,
        "aria-disabled": disabled || undefined,
        "data-checked": checked,
        className: `group/row aria-selected:bg-accent data-[checked=true]:bg-accent/70 ${
          interactive ? "cursor-pointer hover:bg-accent/60" : ""
        } ${disabled ? "opacity-50" : ""}`,
      },
      checkbox: (
        <input
          type="checkbox"
          aria-label="Select row"
          className={`block size-4 cursor-pointer accent-primary disabled:cursor-not-allowed ${anyChosen || checked ? "opacity-100" : REVEAL}`}
          checked={checked}
          disabled={disabled}
          readOnly
        />
      ),
    };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card">
      {anyChosen ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 bg-accent px-3 py-2 text-sm">
          <span className="font-medium">{chosen.length} selected</span>
          {chosen.length === 1 ? (
            <span className="select-all font-mono text-xs text-muted-foreground">ID {rowKey(chosen[0])}</span>
          ) : null}
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
      {view === "cards" ? (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {selectable && visible.length > 0 ? (
            <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              {pageCheckbox}
              Select all on this page
            </label>
          ) : null}
          {rows.length === 0 ? (
            <p className="px-3 py-16 text-center text-sm text-muted-foreground">{empty}</p>
          ) : (
            sections.map((section) => (
            <div key={section.key ?? ""} className="mb-3 last:mb-0">
            {section.key !== null ? <div className="mb-2 overflow-hidden rounded-lg bg-muted/30">{groupHeader(section)}</div> : null}
            <ul
              className={`grid gap-3 ${
                image ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
              }`}
            >
              {section.rows.map((row) => {
                const item = rowState(row);
                const title = columns.find((column) => column.id === cardTitle) ?? columns[0];
                const highlight = columns.find((column) => column.id === cardValue);
                // Empty fields ("—") are noise on a card; the table still shows them.
                const fields = columns
                  .filter((column) => column !== title && column !== highlight)
                  .map((column) => ({ column, value: column.cell(row) }))
                  .filter(({ value }) => value !== "—" && value !== "" && value != null);
                const src = image?.(row);
                return (
                  <li
                    key={item.key}
                    {...item.props}
                    tabIndex={item.interactive ? 0 : undefined}
                    onKeyDown={(event) => {
                      if (item.interactive && (event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
                        event.preventDefault();
                        item.props.onClick?.();
                      }
                    }}
                    className={`${item.props.className} relative flex flex-col overflow-hidden rounded-xl border border-border bg-background/40 transition-[border-color,box-shadow] outline-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring aria-selected:ring-2 aria-selected:ring-primary data-[checked=true]:ring-primary/60`}
                  >
                    {image ? (
                      <div className="aspect-[4/3] bg-muted/40">
                        {src ? (
                          <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground/50">
                            <HugeiconsIcon icon={Image01Icon} size={28} />
                          </div>
                        )}
                      </div>
                    ) : null}
                    {selectable ? <span className="absolute top-2 right-2 rounded-md bg-card/90 p-1">{item.checkbox}</span> : null}
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div className={`min-w-0 font-medium ${selectable && !image ? "pr-8" : ""}`}>{title?.cell(row)}</div>
                      {highlight ? (
                        <p className="flex items-baseline justify-between gap-2">
                          <span className="text-lg font-semibold tabular-nums">{highlight.cell(row)}</span>
                          <span className="text-xs text-muted-foreground">{highlight.header}</span>
                        </p>
                      ) : null}
                      {fields.length ? (
                        <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border/50 pt-2 text-sm">
                          {fields.map(({ column, value }) => (
                            <div key={column.id} className="min-w-0">
                              <dt className="truncate text-xs text-muted-foreground">{column.header}</dt>
                              <dd className="truncate tabular-nums">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            </div>
            ))
          )}
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {selectable ? (
                <th scope="col" className="sticky top-0 z-10 w-10 bg-card py-2.5 pl-3 text-left align-middle shadow-[0_1px_0_var(--input)]">
                  {pageCheckbox}
                </th>
              ) : null}
              {image ? (
                <th scope="col" className="sticky top-0 z-10 w-12 bg-card py-2.5 pl-3 shadow-[0_1px_0_var(--input)]">
                  <span className="sr-only">Photo</span>
                </th>
              ) : null}
              {columns.map((column, shownIndex) => {
                // Moves are positions in the full order, which still includes the hidden grouped column.
                const index = ordered.indexOf(column);
                const neighbor = (key: string) => columns[shownIndex + (key === "ArrowLeft" ? -1 : 1)];
                return (
                <th
                  key={column.id}
                  scope="col"
                  {...(columnOrderKey
                    ? {
                        draggable: true,
                        tabIndex: 0,
                        title: "Drag to move this column (or Alt + ← / →)",
                        onDragStart: (event: DragEvent) => {
                          event.dataTransfer.effectAllowed = "move";
                          setDragging(column.id);
                        },
                        onDragEnd: () => setDragging(null),
                        onDragOver: (event: DragEvent) => {
                          if (dragging) event.preventDefault();
                        },
                        onDrop: (event: DragEvent) => {
                          event.preventDefault();
                          if (dragging && dragging !== column.id) moveColumn(dragging, index);
                          setDragging(null);
                        },
                        onKeyDown: (event: KeyboardEvent) => {
                          if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
                          event.preventDefault();
                          const target = neighbor(event.key);
                          if (!target) return;
                          moveColumn(column.id, ordered.indexOf(target));
                          // Keep focus on the moved header so it can be nudged again.
                          const row = event.currentTarget.parentElement;
                          requestAnimationFrame(() => row?.querySelector<HTMLElement>(`[data-column="${column.id}"]`)?.focus());
                        },
                      }
                    : {})}
                  data-column={column.id}
                  className={`sticky top-0 z-10 whitespace-nowrap bg-card px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-[0_1px_0_var(--input)] ${
                    column.align === "right" ? "text-right" : "text-left"
                  } ${columnOrderKey ? "cursor-grab outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:cursor-grabbing" : ""} ${
                    dragging === column.id ? "opacity-50" : ""
                  }`}
                >
                  {column.header}
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (image ? 1 : 0)} className="px-3 py-16 text-center text-sm text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              sections.map((section) => (
              <Fragment key={section.key ?? ""}>
              {section.key !== null ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0) + (image ? 1 : 0)} className="bg-muted/30 p-0 shadow-[0_1px_0_var(--input)]">
                    {groupHeader(section)}
                  </td>
                </tr>
              ) : null}
              {section.rows.map((row) => {
                const item = rowState(row);
                return (
                  <tr key={item.key} {...item.props}>
                    {selectable ? <td className="w-10 py-2.5 pl-3 text-left align-middle">{item.checkbox}</td> : null}
                    {image ? (
                      <td className="w-12 py-1.5 pl-3 align-middle">
                        {image(row) ? (
                          <img src={image(row)} alt="" loading="lazy" className="size-9 rounded-md object-cover" />
                        ) : (
                          <span className="flex size-9 items-center justify-center rounded-md bg-muted/40 text-muted-foreground/50">
                            <HugeiconsIcon icon={Image01Icon} size={16} />
                          </span>
                        )}
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
              })}
              </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground shadow-[0_-1px_0_var(--input)]">
        <span className="flex items-center gap-2">
          {groupColumn
            ? `${rows.length} results in ${groups.length} ${groups.length === 1 ? "group" : "groups"}`
            : visible.length === 0
              ? `${rows.length} results`
              : `${start + 1}–${start + visible.length} of ${shown}`}
          {groupColumn && groups.length > 1 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpened(opened.size ? new Set() : new Set(groups.map((group) => group.key!)))}
            >
              {opened.size ? "Collapse all" : "Expand all"}
            </Button>
          ) : null}
        </span>
        {groupColumn ? null : (
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
        )}
      </div>
    </div>
  );
}
