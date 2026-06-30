"use client";

import { List, LayoutGrid } from "lucide-react";

export type ViewMode = "table" | "cards";

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-neutral-300 p-0.5 dark:border-neutral-700">
      <Button active={value === "table"} onClick={() => onChange("table")} label="Table">
        <List className="h-4 w-4" />
      </Button>
      <Button active={value === "cards"} onClick={() => onChange("cards")} label="Cards">
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Button({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
