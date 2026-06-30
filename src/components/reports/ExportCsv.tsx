"use client";

import { Download } from "lucide-react";

interface Column<T> {
  key: keyof T & string;
  label: string;
}

/** Generic client-side CSV download — no server round-trip. */
export function ExportCsv<T extends Record<string, unknown>>({
  filename,
  columns,
  rows,
  label = "CSV",
}: {
  filename: string;
  columns: Column<T>[];
  rows: T[];
  label?: string;
}) {
  function download() {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map((c) => esc(c.label)).join(",");
    const body = rows
      .map((r) => columns.map((c) => esc(r[c.key])).join(","))
      .join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
