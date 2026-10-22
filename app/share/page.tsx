"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Report, decodeReport } from "@/lib/reports";
import { ReportActions, ReportDocument } from "@/components/reports/ReportDocument";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";

/** Read-only report opened from a share link. The report itself is in the URL fragment, so no sign-in is needed. */
export default function SharedReportPage() {
  const [report, setReport] = useState<Report | null | undefined>(undefined);

  useEffect(() => {
    const load = () => void decodeReport(window.location.hash.slice(1)).then(setReport);
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <img src="/icon-light.png" alt="" width={24} height={24} className="size-6 dark:invert" />
          OpenTill
        </Link>
        <span className="hidden text-sm text-muted-foreground sm:inline">Shared report</span>
        {report ? (
          <div className="ml-auto flex items-center gap-2">
            <ReportActions report={report} shareable={false} />
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-5xl space-y-3 px-3 pb-8 sm:px-4">
        {report === undefined ? (
          <TablePageSkeleton />
        ) : report === null ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            This link is incomplete or broken. Ask for a new one.
          </p>
        ) : (
          <>
            <ReportDocument report={report} />
            <p className="text-xs text-muted-foreground">
              A copy of the report from {new Date(report.generatedAt).toLocaleString()}. It doesn&apos;t change when the store&apos;s records do.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
