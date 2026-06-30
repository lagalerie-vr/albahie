"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteConsignment } from "@/app/(app)/consignments/actions";

export function DeleteButton({
  consignmentId,
  reference,
}: {
  consignmentId: string;
  reference: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteConsignment(consignmentId);
      if (result?.error) setError(result.error);
      // On success the action redirects, so nothing else to do.
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Delete {reference}?
          </span>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Confirm delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </button>
  );
}
