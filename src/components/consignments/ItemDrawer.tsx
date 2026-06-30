"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  X,
  Pencil,
  FileText,
  FileSignature,
  ExternalLink,
  Receipt,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { CodeLabel } from "@/components/CodeLabel";
import { LightboxImage } from "@/components/LightboxImage";
import { AppraisalDecision } from "@/components/appraisal/AppraisalDecision";
import {
  ItemHistory,
  type ActivityEntry,
} from "@/components/consignments/ItemHistory";
import {
  appraisalUrgency,
  daysUntil,
  formatDate,
  STATUS_META,
  type ConsignmentStatus,
} from "@/lib/consignments";
import { setItemStatus } from "@/app/(app)/inventory/actions";

interface DrawerItem {
  id: string;
  reference: string;
  lot_barcode: string;
  title: string;
  description: string | null;
  category: string | null;
  status: ConsignmentStatus;
  location: string | null;
  height_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  weight_kg: number | null;
  appraisal_due_at: string | null;
  decline_reason: string | null;
  agreement_number: string | null;
  consignment: {
    id: string;
    delivery_note_number: string | null;
    consignor: {
      full_name: string;
      email: string | null;
      phone: string | null;
    } | null;
  } | null;
  photos: { id: string; storage_path: string; is_primary: boolean }[];
  item_activity: ActivityEntry[];
}

interface SaleInfo {
  id: string;
  invoice_number: string | null;
  buyer_name: string | null;
  paddle_no: number | null;
  client_id: string | null;
  hammer_cents: number;
  total_cents: number;
  status: string;
}

function money(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const SELECT = `id, reference, lot_barcode, title, description, category, status, location,
  height_cm, width_cm, depth_cm, weight_kg, appraisal_due_at, decline_reason, agreement_number,
  consignment:consignments ( id, delivery_note_number, consignor:consignors ( full_name, email, phone ) ),
  photos:consignment_item_photos ( id, storage_path, is_primary ),
  item_activity ( id, kind, summary, detail, created_at,
    actor_profile:profiles!item_activity_actor_fkey ( full_name, email ) )`;

export function ItemDrawer({
  itemId,
  onClose,
  context = "consignments",
}: {
  itemId: string | null;
  onClose: () => void;
  context?: "consignments" | "appraisal" | "inventory";
}) {
  const [item, setItem] = useState<DrawerItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [sale, setSale] = useState<SaleInfo | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("consignment_items")
      .select(SELECT)
      .eq("id", id)
      .single();
    setItem((data as unknown as DrawerItem) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (itemId) load(itemId);
    else setItem(null);
  }, [itemId, load]);

  // For sold items, resolve the buyer via the lot → invoice.
  useEffect(() => {
    setSale(null);
    const s = item?.status;
    if (!item || !(s === "sold" || s === "after_sale")) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: lots } = await supabase
        .schema("auction")
        .from("lots")
        .select("id")
        .eq("source_ref", item.id);
      const lotIds = ((lots ?? []) as { id: string }[]).map((l) => l.id);
      if (!lotIds.length) return;
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, invoice_number, buyer_name, paddle_no, client_id, hammer_cents, total_cents, status")
        .in("lot_id", lotIds)
        .maybeSingle();
      if (active && inv) setSale(inv as SaleInfo);
    })();
    return () => {
      active = false;
    };
  }, [item?.id, item?.status]);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (itemId) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [itemId, onClose]);

  if (!itemId || typeof document === "undefined") return null;

  const supabase = createClient();
  const photos = (item?.photos ?? []).map((p) => ({
    id: p.id,
    url: supabase.storage.from("consignment-photos").getPublicUrl(p.storage_path)
      .data.publicUrl,
  }));
  const status = item?.status;
  const pending =
    status === "awaiting_appraisal" || status === "extended_review";
  const showDecision = context === "appraisal" && pending;
  const fullPageHref =
    context === "appraisal"
      ? `/appraisal/items/${itemId}`
      : context === "inventory"
        ? `/inventory/items/${itemId}`
        : `/consignments/items/${itemId}`;
  const urgency = item ? appraisalUrgency(item.status, item.appraisal_due_at) : null;
  const d = item ? daysUntil(item.appraisal_due_at) : null;
  const history = item?.item_activity ?? [];

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-neutral-950">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
          {item ? (
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <StatusBadge status={item.status} />
              </div>
              <p className="font-mono text-xs text-neutral-500">
                {item.reference}
              </p>
            </div>
          ) : (
            <div className="h-6 w-40 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && !item ? (
            <div className="space-y-3">
              <div className="h-32 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-20 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          ) : !item ? (
            <p className="text-sm text-neutral-500">Item not found.</p>
          ) : (
            <div className="space-y-5">
              {/* Appraisal countdown / decision */}
              {urgency && (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    urgency === "overdue"
                      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-700/50 dark:bg-red-950/40 dark:text-red-300"
                      : urgency === "soon"
                        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                  }`}
                >
                  <span className="font-medium">
                    {d !== null && d < 0
                      ? `Overdue by ${Math.abs(d)}d`
                      : d === 0
                        ? "Due today"
                        : `${d}d remaining`}
                  </span>{" "}
                  · due {formatDate(item.appraisal_due_at)}
                </div>
              )}

              {status === "declined" && item.decline_reason && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-700/50 dark:bg-red-950/40">
                  <p className="font-medium text-red-800 dark:text-red-300">
                    Rejected
                  </p>
                  <p className="mt-1 text-red-700 dark:text-red-400">
                    {item.decline_reason}
                  </p>
                </div>
              )}

              {/* Buyer (sold items) */}
              {sale && (
                <div className="rounded-xl border border-green-300 bg-green-50 p-3 dark:border-green-800/50 dark:bg-green-950/30">
                  <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                    <User className="h-3.5 w-3.5" /> Sold to
                  </h3>
                  <p className="font-medium">
                    {sale.client_id ? (
                      <Link href={`/clients/${sale.client_id}`} className="hover:underline">
                        {sale.buyer_name ?? "Buyer"}
                      </Link>
                    ) : (
                      (sale.buyer_name ?? "Buyer")
                    )}
                    {sale.paddle_no != null && (
                      <span className="ml-1 text-xs text-neutral-500">· paddle #{sale.paddle_no}</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Hammer {money(sale.hammer_cents)} · total {money(sale.total_cents)}
                  </p>
                  {sale.invoice_number && (
                    <Link
                      href={`/invoicing/${sale.id}/pay`}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <Receipt className="h-3.5 w-3.5" /> Invoice {sale.invoice_number} · {sale.status}
                    </Link>
                  )}
                </div>
              )}

              {showDecision && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Manager decision
                  </h3>
                  <AppraisalDecision
                    itemId={item.id}
                    currentDueAt={item.appraisal_due_at}
                    onDone={() => load(item.id)}
                  />
                </div>
              )}

              {/* Status control (inventory) */}
              {context === "inventory" && (
                <StatusControl
                  itemId={item.id}
                  current={item.status}
                  onChange={() => load(item.id)}
                />
              )}

              {/* Photos */}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p) => (
                    <LightboxImage
                      key={p.id}
                      src={p.url}
                      alt={item.title}
                      className="aspect-square w-full rounded-lg object-cover ring-1 ring-neutral-200 dark:ring-neutral-800"
                    />
                  ))}
                </div>
              )}

              {/* Details */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field label="Location" value={item.location} />
                <Field label="Category" value={item.category} />
                <Field
                  label="Consignor"
                  value={item.consignment?.consignor?.full_name ?? null}
                />
                <Field
                  label="Dimensions"
                  value={dims(item)}
                />
                <Field
                  label="Weight"
                  value={item.weight_kg != null ? `${item.weight_kg} kg` : null}
                />
                {item.description && (
                  <div className="col-span-2">
                    <Field label="Description" value={item.description} />
                  </div>
                )}
              </dl>

              {/* Label */}
              <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <CodeLabel value={item.lot_barcode} size={104} />
              </div>

              {/* History log */}
              {history.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    History log
                  </h3>
                  <ItemHistory entries={history} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {item && (
          <div className="flex items-center gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
            <Link
              href={fullPageHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <ExternalLink className="h-4 w-4" />
              Full page
            </Link>
            <Link
              href={`/consignments/items/${item.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
            {item.consignment?.id && (
              <Link
                href={`/consignments/intakes/${item.consignment.id}/note`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                <FileText className="h-4 w-4" />
                Note
              </Link>
            )}
            {item.agreement_number && (
              <Link
                href={`/consignments/items/${item.id}/agreement`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                <FileSignature className="h-4 w-4" />
                Agreement
              </Link>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function StatusControl({
  itemId,
  current,
  onChange,
}: {
  itemId: string;
  current: ConsignmentStatus;
  onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function change(status: ConsignmentStatus) {
    if (status === current) return;
    setSaving(true);
    await setItemStatus(itemId, status);
    setSaving(false);
    onChange();
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Status
      </h3>
      <select
        value={current}
        disabled={saving}
        onChange={(e) => change(e.target.value as ConsignmentStatus)}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900"
      >
        {(Object.keys(STATUS_META) as ConsignmentStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-neutral-400">
        Set to <strong>Routed · Auction</strong> or <strong>Cataloged</strong> to make it
        available when building an auction.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}

function dims(it: {
  height_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
}): string | null {
  const parts: string[] = [];
  if (it.height_cm != null) parts.push(`H${it.height_cm}`);
  if (it.width_cm != null) parts.push(`W${it.width_cm}`);
  if (it.depth_cm != null) parts.push(`D${it.depth_cm}`);
  return parts.length ? parts.join(" × ") + " cm" : null;
}
