"use client";

import { useState } from "react";
import { AppraisalQueue, type QueueItem } from "@/components/appraisal/AppraisalQueue";
import {
  AppraisalHistory,
  type HistoryItem,
} from "@/components/appraisal/AppraisalHistory";

export function AppraisalTabs({
  queue,
  history,
}: {
  queue: QueueItem[];
  history: HistoryItem[];
}) {
  const [tab, setTab] = useState<"queue" | "history">("queue");

  return (
    <div>
      <div className="mb-5 inline-flex rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-800">
        <Tab active={tab === "queue"} onClick={() => setTab("queue")}>
          Queue
          <Count value={queue.length} active={tab === "queue"} />
        </Tab>
        <Tab active={tab === "history"} onClick={() => setTab("history")}>
          Appraised history
          <Count value={history.length} active={tab === "history"} />
        </Tab>
      </div>

      {tab === "queue" ? (
        queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Nothing awaiting appraisal. The tray is clear.
          </div>
        ) : (
          <AppraisalQueue items={queue} />
        )
      ) : (
        <AppraisalHistory items={history} />
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
        active
          ? "bg-white/20 dark:bg-neutral-900/20"
          : "bg-neutral-100 dark:bg-neutral-800"
      }`}
    >
      {value}
    </span>
  );
}
