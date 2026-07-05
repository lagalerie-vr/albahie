"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { updateIntake, type IntakeState } from "@/app/(app)/consignments/actions";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/consignments";

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-1 focus:ring-brand-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-brand-400 dark:focus:ring-brand-400";
const label = "mb-1 block text-sm font-medium";
const section =
  "rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900";

interface ExistingPhoto {
  id: string;
  url: string;
}

export function EditForm({
  item,
  consignor,
  consignmentNotes,
  existingPhotos,
  managers,
}: {
  item: {
    id: string;
    consignment_id: string;
    title: string;
    description: string | null;
    category: string | null;
    height_cm: number | null;
    width_cm: number | null;
    depth_cm: number | null;
    weight_kg: number | null;
    responsible_manager: string | null;
    received_at: string;
  };
  consignor: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  consignmentNotes: string | null;
  existingPhotos: ExistingPhoto[];
  managers: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState<IntakeState, FormData>(
    updateIntake,
    null,
  );
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const visiblePhotos = existingPhotos.filter((p) => !removedIds.includes(p.id));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const fd = new FormData(e.currentTarget);
    fd.delete("photos");
    fd.set("removed_photo_ids", JSON.stringify(removedIds));

    if (newFiles.length > 0) {
      setUploading(true);
      const supabase = createClient();
      const batch = crypto.randomUUID();
      const paths: string[] = [];
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
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
      fd.set("new_photo_paths", JSON.stringify(paths));
      setUploading(false);
    }

    formAction(fd);
  }

  const busy = uploading || isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="item_id" value={item.id} />
      <input type="hidden" name="consignment_id" value={item.consignment_id} />
      <input type="hidden" name="consignor_id" value={consignor.id} />

      {/* Consignor */}
      <div className={section}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Consignor (Seller)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Full name *</label>
            <input
              name="consignor_name"
              className={input}
              defaultValue={consignor.full_name}
              required
            />
          </div>
          <div>
            <label className={label}>Email</label>
            <input
              name="consignor_email"
              type="email"
              className={input}
              defaultValue={consignor.email ?? ""}
            />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input
              name="consignor_phone"
              className={input}
              defaultValue={consignor.phone ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Address</label>
            <input
              name="consignor_address"
              className={input}
              defaultValue={consignor.address ?? ""}
            />
          </div>
        </div>
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
              defaultValue={item.title}
              required
            />
          </div>
          <div>
            <label className={label}>Category</label>
            <select
              name="category"
              className={input}
              defaultValue={item.category ?? ""}
            >
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
              defaultValue={item.description ?? ""}
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
            <input name="height_cm" type="number" step="0.1" min="0" className={input} defaultValue={item.height_cm ?? ""} />
          </div>
          <div>
            <label className={label}>Width (cm)</label>
            <input name="width_cm" type="number" step="0.1" min="0" className={input} defaultValue={item.width_cm ?? ""} />
          </div>
          <div>
            <label className={label}>Depth (cm)</label>
            <input name="depth_cm" type="number" step="0.1" min="0" className={input} defaultValue={item.depth_cm ?? ""} />
          </div>
          <div>
            <label className={label}>Weight (kg)</label>
            <input name="weight_kg" type="number" step="0.001" min="0" className={input} defaultValue={item.weight_kg ?? ""} />
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className={section}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Photographs
        </h2>

        {visiblePhotos.length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {visiblePhotos.map((p) => (
              <div key={p.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt="Item"
                  className="aspect-square w-full rounded-lg object-cover ring-1 ring-neutral-200 dark:ring-neutral-800"
                />
                <button
                  type="button"
                  onClick={() => setRemovedIds((ids) => [...ids, p.id])}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 transition hover:border-neutral-400 dark:border-neutral-700">
          <input
            name="photos"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))}
          />
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Click to add photos
          </span>
        </label>
        {newFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {newFiles.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-lg bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800"
              >
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
              defaultValue={item.responsible_manager ?? ""}
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
              defaultValue={toLocalDatetime(new Date(item.received_at))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Intake notes</label>
            <textarea
              name="notes"
              rows={2}
              className={input}
              defaultValue={consignmentNotes ?? ""}
            />
          </div>
        </div>
      </div>

      {(state?.error || uploadError) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {uploadError ?? state?.error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={busy}
          className="flex w-48 items-center justify-center rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          {uploading ? "Uploading photos…" : isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
