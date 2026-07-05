"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400"
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
