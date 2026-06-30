"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
