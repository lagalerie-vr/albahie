"use client";

import { useActionState, useState } from "react";
import { createIntake, type IntakeState } from "@/app/(app)/consignments/actions";
import { ConsignorPicker } from "@/components/consignments/ConsignorPicker";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, type ConsignorSummary } from "@/lib/consignments";

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-1 focus:ring-brand-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-brand-400 dark:focus:ring-brand-400";
const label = "mb-1 block text-sm font-medium";
const section =
  "rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900";

export function IntakeForm({
  consignors,
  managers,
  currentUserId,
}: {
  consignors: ConsignorSummary[];
  managers: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [state, formAction, isPending] = useActionState<IntakeState, FormData>(
    createIntake,
    null,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload photos straight to Supabase Storage from the browser (avoids the
  // Server Action body-size limit), then hand the action only the file paths.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const fd = new FormData(e.currentTarget);
    fd.delete("photos");

    if (files.length > 0) {
      setUploading(true);
      const supabase = createClient();
      const batch = crypto.randomUUID();
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `intake/${batch}/${i}.${ext}`;
        const { error } = await supabase.storage
          .from("consignment-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) {
          setUploading(false);
          setUploadError(`Photo upload failed: ${error.message}`);
          return;
        }
        paths.push(path);
      }
      fd.set("photo_paths", JSON.stringify(paths));
      setUploading(false);
    }

    formAction(fd);
  }

  const busy = uploading || isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Consignor */}
      <div className={section}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Consignor (Seller)
        </h2>
        <ConsignorPicker consignors={consignors} />
      </div>

      {/* Item */}
      <div className={section}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Item
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Title *</label>
            <input
              name="title"
              className={input}
              placeholder="e.g. Victorian mahogany writing desk"
              required
            />
          </div>
          <div>
            <label className={label}>Category</label>
            <select name="category" className={input} defaultValue="">
              <option value="">Unassigned</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Description</label>
            <textarea
              name="description"
              rows={3}
              className={input}
              placeholder="Condition notes, provenance, marks…"
            />
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className={section}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Dimensions
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className={label}>Height (cm)</label>
            <input name="height_cm" type="number" step="0.1" min="0" className={input} />
          </div>
          <div>
            <label className={label}>Width (cm)</label>
            <input name="width_cm" type="number" step="0.1" min="0" className={input} />
          </div>
          <div>
            <label className={label}>Depth (cm)</label>
            <input name="depth_cm" type="number" step="0.1" min="0" className={input} />
          </div>
          <div>
            <label className={label}>Weight (kg)</label>
            <input name="weight_kg" type="number" step="0.001" min="0" className={input} />
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className={section}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Photographs
        </h2>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 transition hover:border-neutral-400 dark:border-neutral-700">
          <input
            name="photos"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Click to add photos
          </span>
          <span className="mt-1 text-xs">First photo becomes the primary image</span>
        </label>
        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800"
              >
                {i === 0 && (
                  <span className="rounded bg-neutral-900 px-1 text-[10px] text-white dark:bg-white dark:text-neutral-900">
                    primary
                  </span>
                )}
                {f.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Receiving */}
      <div className={section}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Receiving
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Responsible manager</label>
            <select
              name="responsible_manager"
              className={input}
              defaultValue={currentUserId}
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Received at</label>
            <input
              name="received_at"
              type="datetime-local"
              className={input}
              defaultValue={toLocalDatetime(new Date())}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Intake notes</label>
            <textarea name="notes" rows={2} className={input} />
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          On submit, a delivery note and barcode/QR are generated, the item is
          logged to inventory as <strong>Awaiting Appraisal</strong>, and a
          14-day appraisal window begins.
        </p>
      </div>

      {(state?.error || uploadError) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {uploadError ?? state?.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="flex w-48 items-center justify-center rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400 dark:focus:ring-offset-neutral-950"
        >
          {uploading
            ? "Uploading photos…"
            : isPending
              ? "Receiving…"
              : "Receive item"}
        </button>
      </div>
    </form>
  );
}

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
