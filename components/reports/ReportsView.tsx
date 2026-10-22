"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { presetRange, rangeFromParams, toDateInput } from "@/lib/periods";
import {
  REPORT_TYPES,
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
  typeLabel,
} from "@/lib/reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/data-table/bulk";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { DateRangeFilter } from "@/components/data-table/DateRangeFilter";
import { DetailPanel, Fields, SplitView } from "@/components/data-table/DetailPanel";
import { FilterSelect, ResetFiltersButton, SearchBox, StatTile, FilterBar, ViewBySelect, matches, useViewMode } from "@/components/data-table/controls";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";
import { ReportActions } from "./ReportDocument";
import { GenerateReportDialog } from "./GenerateReportDialog";

const TYPES = [{ value: "all", label: "All reports" }, ...REPORT_TYPES];
const SPANS = [
  { value: "all", label: "Monthly and yearly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

/** The store's records in the shape reports are built from. */
export function useReportData() {
  const { activeTenant, tenantSyncedOrders } = usePos();
  const { expenses, movements, suppliers, ready } = useOps();
  const data = useMemo(
    () => ({ orders: tenantSyncedOrders, expenses, movements, suppliers }),
    [tenantSyncedOrders, expenses, movements, suppliers]
  );
  const store = useMemo(
    () => ({ name: activeTenant?.name ?? "", currency: activeTenant?.currency ?? "PHP" }),
    [activeTenant?.name, activeTenant?.currency]
  );
  return { tenant: activeTenant, data, store, ready: ready.expenses && ready.movements && ready.suppliers };
}


export function ReportsView() {
  const { tenant, data, store, ready } = useReportData();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [type, setType] = useState(() => params.get("type") ?? "all");
  const [span, setSpan] = useState("all");
  const [view, setView] = useViewMode("reports", "cards");
  const [range, setRange] = useState(() => rangeFromParams(params, "all"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const reports = useMemo(() => allReports(data, store), [data, store]);
  const rows = useMemo(
    () =>
      reports.filter((r) => {
        const { from, to } = periodBounds(r.period);
        return (
          (type === "all" || r.type === type) &&
          (span === "all" || (span === "year") === isYear(r.period)) &&
          (!range.to || from <= range.to) &&
          (!range.from || to >= range.from) &&
          matches(query, r.title, typeLabel(r.type), periodLabel(r.period))
        );
      }),
    [reports, type, span, range, query]
  );
  const thisMonth = useMemo(
    () => buildReport("profit", toDateInput(new Date().toISOString()).slice(0, 7), data, store),
    [data, store]
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
          {thisMonth.summary.map((s) => (
            <StatTile key={s.label} label={s.label} value={formatValue(s.value, s.kind, store.currency)} hint="This month" />
          ))}
        </div>
        <FilterBar active={filtersActive} actions={<Button onClick={() => setGenerating(true)}>Generate report</Button>}>
          <SearchBox value={query} onChange={setQuery} placeholder="Search reports…" />
          <FilterSelect label="Report type" value={type} onChange={setType} options={TYPES} />
          <FilterSelect label="Period" value={span} onChange={setSpan} options={SPANS} />
          <DateRangeFilter value={range} onChange={setRange} />
          <ViewBySelect value={view} onChange={setView} />
          {filtersActive ? <ResetFiltersButton onClick={resetFilters} /> : null}
        </FilterBar>
        <GenerateReportDialog open={generating} onClose={() => setGenerating(false)} />
        <DataTable
          rows={rows}
          columns={columns}
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
          empty={reports.length === 0 ? "Reports appear here once you have sales, expenses or restocks." : "Nothing matches those filters."}
        />
      </SplitView>
    </div>
  );
}
