"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PERIOD, REPORT_TYPES, ReportType, buildReport } from "@/lib/reports";
import { useReportData } from "@/components/reports/ReportsView";
import { ReportActions, ReportDocument } from "@/components/reports/ReportDocument";
import { Toolbar } from "@/components/data-table/controls";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";

function ReportPage() {
  const params = useSearchParams();
  const type = params.get("type") as ReportType | null;
  const period = params.get("period") ?? "";
  const { tenant, data, store, ready } = useReportData();
  const valid = REPORT_TYPES.some((t) => t.value === type) && PERIOD.test(period);
  const report = useMemo(() => (valid && type ? buildReport(type, period, data, store) : null), [valid, type, period, data, store]);

  if (!tenant) return null;
  if (!ready) return <TablePageSkeleton />;
  if (!report) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        That report doesn&apos;t exist.{" "}
        <Link href="/reports" className="text-foreground underline-offset-4 hover:underline">
          Back to reports
        </Link>
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Toolbar>
        <ReportActions report={report} />
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <ReportDocument report={report} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <ReportPage />
    </Suspense>
  );
}
