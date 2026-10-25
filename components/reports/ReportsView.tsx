"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useOps } from "@/contexts/ops-context";
import { isCashier } from "@/lib/local-auth";
import { usePos } from "@/contexts/pos-context";
import { presetRange, toDateInput } from "@/lib/periods";
import {
  Report,
  allReports,
  buildReport,
  formatValue,
  isYear,
  periodBounds,
  periodLabel,
  rangeLabel,
  reportHref,
  reportKey,
  reportTypesFor,
  typeLabel,
} from "@/lib/reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/data-table/bulk";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { DateRangeFilter, useRangeFilter } from "@/components/data-table/DateRangeFilter";
import { DetailPanel, Fields, SplitView } from "@/components/data-table/DetailPanel";
import { FileAddIcon } from "@hugeicons/core-free-icons";
import { ToolbarButton, FilterSelects, passesFilters, type RowFilter, ResetFiltersButton, SearchBox, StatTile, FilterBar, ViewBySelect, GroupBySelect, useGroupBy, useFilter, matches, useViewMode } from "@/components/data-table/controls";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";
import { ReportActions } from "./ReportDocument";
import { GenerateReportDialog } from "./GenerateReportDialog";

const SPANS = [
  { value: "all", label: "Monthly and yearly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

/** The store's records in the shape reports are built from. */
export function useReportData() {
  const { activeTenant, tenantSyncedOrders } = usePos();
  const { expenses, movements, suppliers, ready } = useOps();
  const types = reportTypesFor(isCashier(useAuth().user));
  const data = useMemo(
    () => ({ orders: tenantSyncedOrders, expenses, movements, suppliers }),
    [tenantSyncedOrders, expenses, movements, suppliers]
  );
  const store = useMemo(
    () => ({ name: activeTenant?.name ?? "", currency: activeTenant?.currency ?? "PHP" }),
    [activeTenant?.name, activeTenant?.currency]
  );
  return { tenant: activeTenant, data, store, types, ready: ready.expenses && ready.movements && ready.suppliers };
}


export function ReportsView() {
  const { tenant, data, store, types, ready } = useReportData();
  const params = useSearchParams();
  const [query, setQuery] = useFilter("reports_query", "");
  const [type, setType] = useFilter("reports_type", "all", params.get("type") ?? undefined);
  const [span, setSpan] = useFilter("reports_span", "all");
  const [view, setView] = useViewMode("reports", "cards");
  const [groupBy, setGroupBy] = useGroupBy("reports");
  const [range, setRange] = useRangeFilter("reports", params, "all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const reports = useMemo(() => allReports(data, store, types), [data, store, types]);
  const filters: RowFilter<(typeof reports)[number]>[] = [
    { id: "type", label: "Report type", value: type, onChange: setType, options: [{ value: "all", label: "All reports" }, ...types], test: (r, v) => r.type === v },
    { id: "span", label: "Period", value: span, onChange: setSpan, options: SPANS, test: (r, v) => (v === "year") === isYear(r.period) },
  ];
  const rows = useMemo(
    () =>
      reports.filter((r) => {
        const { from, to } = periodBounds(r.period);
        return (
          passesFilters(r, filters) &&
          (!range.to || from <= range.to) &&
          (!range.from || to >= range.from) &&
          matches(query, r.title, typeLabel(r.type), periodLabel(r.period))
        );
      }),
    [reports, type, span, range, query]
  );
  // Admins see this month's profit and loss; cashiers see this month's sales.
  const headline = types.some((t) => t.value === "profit") ? "profit" : "sales";
  const thisMonth = useMemo(
    () => buildReport(headline, toDateInput(new Date().toISOString()).slice(0, 7), data, store),
    [headline, data, store]
  );

  const columns: Column<Report>[] = [
    { id: "report", header: "Report", cell: (r) => <span className="font-medium">{r.title}</span> },
    { id: "type", header: "Type", cell: (r) => <Badge variant="secondary">{typeLabel(r.type)}</Badge> },
    { id: "span", header: "Period", cell: (r) => (isYear(r.period) ? "Yearly" : "Monthly") },
    { id: "date", header: "Date", cell: (r) => <span className="whitespace-nowrap">{rangeLabel(r.period)}</span> },
    {
      id: "total",
      header: "Total",
      align: "right",
      cell: (r) => (
        <span className="font-medium" title={r.summary[0].label}>
          {formatValue(r.summary[0].value, r.summary[0].kind, r.currency)}
        </span>
      ),
    },
  ];

  if (!tenant) return null;
  if (!ready) return <TablePageSkeleton />;

  const filtersActive = query.trim() !== "" || type !== "all" || span !== "all" || range.preset !== "all";
  const resetFilters = () => {
    setQuery("");
    setType("all");
    setSpan("all");
    setRange(presetRange("all"));
    setSelectedId(null);
  };

  const selected = reports.find((r) => reportKey(r) === selectedId) ?? null;
  const panel = selected ? (
    <DetailPanel
      title={selected.title}
      subtitle={rangeLabel(selected.period)}
      onClose={() => setSelectedId(null)}
      actions={
        <>
          <Button asChild>
            <Link href={reportHref(selected)}>Open report</Link>
          </Button>
          <ReportActions report={selected} />
        </>
      }
    >
      <Fields rows={selected.summary.map((s) => [s.label, formatValue(s.value, s.kind, selected.currency)])} />
      {selected.note ? <p className="text-xs text-muted-foreground">{selected.note}</p> : null}
      <p className="text-xs text-muted-foreground">
        Open the report for the full table, or save it as a PDF or Excel file. A share link is a copy of the report as it is now,
        and anyone with the link can view it.
      </p>
    </DetailPanel>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SplitView panel={panel}>
        <div className="hidden shrink-0 grid-cols-3 gap-3 sm:grid">
          {thisMonth.summary.slice(0, 3).map((s) => (
            <StatTile key={s.label} label={s.label} value={formatValue(s.value, s.kind, store.currency)} hint="This month" />
          ))}
        </div>
        <FilterBar active={filtersActive} actions={<ToolbarButton icon={FileAddIcon} label="Generate report" short="Generate" onClick={() => setGenerating(true)} />}>
          <SearchBox value={query} onChange={setQuery} placeholder="Search reports…" />
          <FilterSelects filters={filters} />
          <DateRangeFilter value={range} onChange={setRange} />
          <ViewBySelect value={view} onChange={setView} />
          <GroupBySelect columns={columns} value={groupBy} onChange={setGroupBy} />
          {filtersActive ? <ResetFiltersButton onClick={resetFilters} /> : null}
        </FilterBar>
        <GenerateReportDialog open={generating} onClose={() => setGenerating(false)} />
        <DataTable
          rows={rows}
          columns={columns}
            groupBy={groupBy}
            stateKey="reports"
            rowFilters={filters}
          rowKey={reportKey}
          view={view}
          cardValue="total"
          onRowClick={(r, checked) => setSelectedId((current) => (checked ? reportKey(r) : current === reportKey(r) ? null : current))}
          selectedKey={selectedId}
          bulkActions={(chosen) => (
            <ExportButton
              filename="reports.csv"
              headers={["Report", "Type", "Period", "From", "To", "Headline", "Value"]}
              rows={chosen.map((r) => {
                const { from, to } = periodBounds(r.period);
                return [r.title, typeLabel(r.type), isYear(r.period) ? "Yearly" : "Monthly", from, to, r.summary[0].label, r.summary[0].value];
              })}
            />
          )}
          resetKey={`${query}|${type}|${span}|${range.from}|${range.to}`}
          empty={reports.length === 0 ? `Reports appear here once you have ${headline === "profit" ? "sales, expenses or restocks" : "sales"}.` : "Nothing matches those filters."}
        />
      </SplitView>
    </div>
  );
}
