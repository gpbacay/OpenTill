"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toDateInput } from "@/lib/periods";
import { REPORT_TYPES, ReportType, periodLabel, rangeLabel, reportHref } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Make this month's report on demand. Reports for every month and year are also built automatically. */
export function GenerateReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<ReportType>("sales");
  const period = toDateInput(new Date().toISOString()).slice(0, 7);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate report</DialogTitle>
          <DialogDescription>
            {periodLabel(period)}, {rangeLabel(period)}. Reports for each month and year are also made automatically on the
            Reports page.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onClose();
            router.push(reportHref({ type, period }));
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="report-type">Report</Label>
            <select
              id="report-type"
              value={type}
              onChange={(event) => setType(event.target.value as ReportType)}
              className="h-8 w-full rounded-lg bg-input px-2 text-sm"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit">Generate report</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
