"use client";

import { Fragment, isValidElement, useEffect, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, FilterHorizontalIcon, Image01Icon, MultiplicationSignIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { passesFilters, useFilter, type RowFilter } from "./controls";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  className?: string;
  /** Group label when rows are grouped by this column. Defaults to the cell's text, with groups sorted A–Z; when given, groups keep the rows' order (e.g. newest day first). */
  group?: (row: T) => string;
  /** false hides it from "View by column", e.g. the name column of a list of those things: one group per row. */
  groupable?: false;
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
  /** Remembers each group's own search and filters on this device under this key. Defaults to `columnOrderKey`. */
  stateKey?: string;
  /** The page's filters, offered again inside each group with only the choices that group has. */
  rowFilters?: RowFilter<T>[];
  /** Row photo: a cover on cards and a thumbnail in the table. Return "" or undefined for a placeholder. */
  image?: (row: T) => string | undefined;
}

// Row checkboxes stay hidden until the row is hovered or focused, or something is already selected (always shown on
// touch screens). The select-all checkbox in the header is always visible so a selection can always be undone.
const REVEAL = "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100";

/** Column order saved on this device. A column the saved order hasn't seen yet (e.g. a new one) goes right after the one it follows by default. */
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

  const ordered = key ? columns.filter((column) => saved.includes(column.id)).sort((a, b) => saved.indexOf(a.id) - saved.indexOf(b.id)) : [...columns];
  if (key)
    columns.forEach((column, i) => {
      if (!saved.includes(column.id)) ordered.splice(i === 0 ? 0 : ordered.indexOf(columns[i - 1]) + 1, 0, column);
    });

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

/** One group's own search, and its own value for each of the page's filters (by filter id; missing means "all"). */
type GroupFilter = { query: string; filters: Record<string, string> };

function passes<T>(row: T, columns: Column<T>[], rowFilters: RowFilter<T>[], { query, filters }: GroupFilter) {
  if (!passesFilters(row, rowFilters, filters)) return false;
  const q = query.trim().toLowerCase();
  return !q || columns.some((column) => textOf(column.cell(row)).toLowerCase().includes(q));
}

/** A page filter as offered inside one group: its "all" option plus only the choices some row of the group has. */
function groupChoices<T>(rows: T[], filter: RowFilter<T>, chosen?: string) {
  const [all, ...rest] = filter.options;
  return [all, ...rest.filter((option) => option.value === chosen || rows.some((row) => filter.test(row, option.value)))];
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
  stateKey,
  rowFilters = [],
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

  const groupColumn = ordered.find((column) => column.id === groupBy && column.groupable !== false);
  // The grouped column's value is already in each group header.
  const columns = ordered.filter((column) => column !== groupColumn);
  const [groupFilters, setGroupFilters] = useFilter<Record<string, GroupFilter>>(`${stateKey ?? columnOrderKey ?? "table"}_${groupBy}_groups`, {});
  // `filters ?? {}`: older saves held a single column filter instead.
  const filterOf = (key: string): GroupFilter => ({ query: groupFilters[key]?.query ?? "", filters: groupFilters[key]?.filters ?? {} });
  const setGroupFilter = (key: string, change: Partial<GroupFilter>) => {
    const next = { ...filterOf(key), ...change };
    next.filters = Object.fromEntries(Object.entries(next.filters).filter(([, value]) => value !== "all"));
    const rest = Object.fromEntries(Object.entries(groupFilters).filter(([other]) => other !== key));
    setGroupFilters(next.query || Object.keys(next.filters).length ? { ...rest, [key]: next } : rest);
  };
  const resetGroup = (key: string) => setGroupFilter(key, { query: "", filters: {} });
  const allGroups = groupRows(rows, groupColumn);
  const totals = new Map(allGroups.map((group) => [group.key, group.rows]));
  // Each group narrows its own rows with its search and filter; the page's filters already ran.
  const groups = allGroups.map((group) =>
    group.key !== null && groupFilters[group.key] ? { ...group, rows: group.rows.filter((row) => passes(row, columns, rowFilters, filterOf(group.key!))) } : group
  );
  const listed = groups.flatMap((group) => group.rows);
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

  /**
   * Group row: open/close, plus (when open) the group's own search, the page's filters narrowed to this group, and a
   * reset once either is used, right after its name on the one line.
   */
  const groupHeader = (section: Section<T>) => {
    if (section.key === null || !groupColumn) return null;
    const key = section.key;
    const open = opened.has(key);
    const all = totals.get(key) ?? [];
    const own = filterOf(key);
    // A filter with one real choice left (or none) can't narrow this group, unless it is already set here.
    const menus = open
      ? rowFilters
          .map((filter) => ({ filter, choices: groupChoices(all, filter, own.filters[filter.id]) }))
          .filter(({ filter, choices }) => choices.length > 2 || own.filters[filter.id])
      : [];
    const setHere = menus.filter(({ filter }) => own.filters[filter.id]);
    const filterLabel = setHere.length
      ? setHere.map(({ filter, choices }) => `${filter.label}: ${choices.find((c) => c.value === own.filters[filter.id])?.label}`).join(", ")
      : `Filter ${key}`;
    const narrowed = Boolean(own.query || Object.keys(own.filters).length);
    return (
      <div
        className="flex items-center gap-2 pr-2 hover:bg-accent/60"
        onClick={(event) => {
          if (event.target === event.currentTarget) toggleGroup(key);
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggleGroup(key)}
          className="flex min-w-0 items-center gap-2 py-2.5 pl-3 text-left text-sm font-semibold"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
          <span className="sr-only">{groupColumn.header}</span>
          <span className="truncate text-foreground">{key}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground">
            {section.count < all.length ? `${section.count}/${all.length}` : all.length}
          </span>
        </button>
        {open ? (
          <>
            <label className="relative shrink-0">
              <HugeiconsIcon icon={Search01Icon} size={14} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={own.query}
                onChange={(event) => setGroupFilter(key, { query: event.target.value })}
                placeholder="Search"
                aria-label={`Search ${key}`}
                // Narrow until used, so it never crowds the group name on phones.
                className={`h-7 rounded-md bg-input pr-1.5 pl-7 text-xs outline-none transition-[width] focus-visible:ring-2 focus-visible:ring-ring ${own.query ? "w-32 sm:w-44" : "w-24 focus:w-32 sm:focus:w-44"}`}
              />
            </label>
            {menus.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    title={filterLabel}
                    aria-label={filterLabel}
                    className={`flex size-7 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      setHere.length ? "bg-primary text-primary-foreground" : "bg-input text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <HugeiconsIcon icon={FilterHorizontalIcon} size={14} />
                  </button>
                </DropdownMenuTrigger>
                {/* One short line per filter; its choices open beside it, so a long list never fills the screen. */}
                <DropdownMenuContent align="start" className="w-auto min-w-44">
                  <DropdownMenuLabel>Filter {key}</DropdownMenuLabel>
                  {menus.map(({ filter, choices }) => (
                    <DropdownMenuSub key={filter.id}>
                      <DropdownMenuSubTrigger>
                        {filter.label}
                        {own.filters[filter.id] ? (
                          <span className="ml-auto max-w-28 truncate pl-3 text-xs text-muted-foreground">
                            {choices.find((choice) => choice.value === own.filters[filter.id])?.label}
                          </span>
                        ) : null}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                        <DropdownMenuRadioGroup
                          value={own.filters[filter.id] ?? choices[0].value}
                          onValueChange={(value) => setGroupFilter(key, { filters: { ...own.filters, [filter.id]: value } })}
                        >
                          {choices.map((choice) => (
                            <DropdownMenuRadioItem key={choice.value} value={choice.value}>
                              {choice.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {narrowed ? (
              <button
                type="button"
                onClick={() => resetGroup(key)}
                title={`Reset filters for ${key}`}
                aria-label={`Reset filters for ${key}`}
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-input text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <HugeiconsIcon icon={MultiplicationSignIcon} size={14} />
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    );
  };

  /** Shown inside an open group whose own search or filter leaves nothing. */
  const noGroupMatch = (section: Section<T>) =>
    section.key !== null && opened.has(section.key) && section.rows.length === 0 && groupFilters[section.key] ? (
      <p className="px-3 py-3 text-center text-xs text-muted-foreground">Nothing in {section.key} matches.</p>
    ) : null;

  const available = listed.filter((row) => !isRowDisabled?.(row));
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
            {noGroupMatch(section)}
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
              {noGroupMatch(section) ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0) + (image ? 1 : 0)}>{noGroupMatch(section)}</td>
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
            ? `${listed.length} results in ${groups.length} ${groups.length === 1 ? "group" : "groups"}`
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
