"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link01Icon, Pdf01Icon, Xls01Icon } from "@hugeicons/core-free-icons";
import { Report, downloadReportCsv, encodeReport, formatValue, rangeLabel } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/data-table/controls";

const PRINT_CSS = `
  @media print {
    body > :not(.report-print) { display: none !important; }
    .report-print, .report-print * { color: #000 !important; background: transparent !important; box-shadow: none !important; }
    .report-print th, .report-print td { border-bottom: 1px solid #ddd !important; }
  }
  @page { margin: 12mm; }
`;

export function ReportDocument({ report }: { report: Report }) {
  return (
    <article className="space-y-3">
      <header>
        <p className="text-sm text-muted-foreground">{report.store}</p>
        <h2 className="text-xl font-bold">{report.title}</h2>
        <p className="text-xs text-muted-foreground">
          {rangeLabel(report.period, report.generatedAt)} · Made {new Date(report.generatedAt).toLocaleString()}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {report.summary.map((item) => (
          <StatTile key={item.label} label={item.label} value={formatValue(item.value, item.kind, report.currency)} />
        ))}
      </div>
      {report.note ? <p className="text-xs text-muted-foreground">{report.note}</p> : null}
      <div className="overflow-x-auto rounded-xl bg-card">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {report.columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-[0_1px_0_var(--input)] ${
                    column.kind && column.kind !== "text" ? "text-right" : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={report.columns.length} className="px-3 py-16 text-center text-muted-foreground">
                  Nothing recorded in this period.
                </td>
              </tr>
            ) : (
              report.rows.map((row, index) => (
                <tr key={index} className="break-inside-avoid hover:bg-accent/60">
                  {report.columns.map((column, col) => (
                    <td
                      key={column.label}
                      className={`px-3 py-2 align-middle ${column.kind && column.kind !== "text" ? "text-right tabular-nums" : ""}`}
                    >
                      {formatValue(row[col] ?? "", column.kind, report.currency)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

/** PDF (the browser's print dialog, "Save as PDF"), Excel and share-link buttons for one report. */
export function ReportActions({ report, shareable = true }: { report: Report; shareable?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setMounted(true), []);

  const share = async () => {
    const url = `${window.location.origin}/share#${await encodeReport(report)}`;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: report.title, url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => window.print()}>
        <HugeiconsIcon icon={Pdf01Icon} size={16} />
        PDF
      </Button>
      <Button variant="secondary" onClick={() => downloadReportCsv(report)}>
        <HugeiconsIcon icon={Xls01Icon} size={16} />
        Excel
      </Button>
      {shareable ? (
        <Button variant="secondary" onClick={() => void share()}>
          <HugeiconsIcon icon={Link01Icon} size={16} />
          {copied ? "Link copied" : "Share link"}
        </Button>
      ) : null}
      {/* Printed copy sits straight under <body> so the app shell's fixed heights can't clip it to one page. */}
      {mounted
        ? createPortal(
            <div className="report-print hidden print:block">
              <style>{PRINT_CSS}</style>
              <ReportDocument report={report} />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
