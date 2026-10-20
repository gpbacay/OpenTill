type Cell = string | number | boolean | null | undefined;

const escape = (value: Cell) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Save rows as a CSV file (with a BOM so Excel reads UTF-8 such as the peso sign correctly). */
export function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
