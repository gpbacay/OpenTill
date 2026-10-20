"use client";

import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";

/** Selection-bar buttons shared by every table. */
export function ExportButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  return (
    <Button size="sm" variant="secondary" onClick={() => downloadCsv(filename, headers, rows)}>
      Export CSV
    </Button>
  );
}

export function DeleteButton({ count, noun, onConfirm }: { count: number; noun: string; onConfirm: () => void }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className="text-destructive"
      onClick={() => {
        if (window.confirm(`Delete ${count} ${noun}${count === 1 ? "" : "s"}? This can't be undone.`)) onConfirm();
      }}
    >
      Delete
    </Button>
  );
}
