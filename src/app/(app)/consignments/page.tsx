import Link from "next/link";
import { Plus, Package, Clock, AlertTriangle, Archive } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  ConsignmentsTable,
  type ConsignmentListItem,
} from "@/components/consignments/ConsignmentsTable";
import { appraisalUrgency, type ConsignmentStatus } from "@/lib/consignments";

const IN_CUSTODY: ConsignmentStatus[] = [
  "awaiting_appraisal",
  "extended_review",
  "accepted",
  "routed_auction",
  "routed_private",
  "cataloged",
  "in_auction",
  "after_sale",
];

export default async function ConsignmentsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("consignment_items")
    .select(
      `id, reference, title, category, status, received_at, appraisal_due_at, responsible_manager,
       consignment:consignments ( reference, consignor:consignors ( full_name ) ),
       photos:consignment_item_photos ( storage_path, is_primary )`,
    )
    .order("received_at", { ascending: false });

  const rows = ((data ?? []) as unknown as (ConsignmentListItem & {
    photos: { storage_path: string; is_primary: boolean }[];
  })[]).map((r) => {
    const photos = r.photos ?? [];
    const chosen = photos.find((p) => p.is_primary) ?? photos[0];
    return {
      ...r,
      photo_url: chosen
        ? supabase.storage
            .from("consignment-photos")
            .getPublicUrl(chosen.storage_path).data.publicUrl
        : null,
    } as ConsignmentListItem;
  });

  const awaiting = rows.filter(
    (r) => r.status === "awaiting_appraisal" || r.status === "extended_review",
  );
  const dueSoon = awaiting.filter(
    (r) => appraisalUrgency(r.status, r.appraisal_due_at) === "soon",
  );
  const overdue = awaiting.filter(
    (r) => appraisalUrgency(r.status, r.appraisal_due_at) === "overdue",
  );
  const inCustody = rows.filter((r) => IN_CUSTODY.includes(r.status));

  // Reminders surfaced to the responsible manager (admins see all).
  const myAttention = awaiting.filter((r) => {
    const u = appraisalUrgency(r.status, r.appraisal_due_at);
    if (u !== "soon" && u !== "overdue") return false;
    return profile.role === "admin" || r.responsible_manager === profile.id;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Consignments</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Intake, appraisal, and custody of consigned property.
          </p>
        </div>
        <Link
          href="/consignments/new"
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Plus className="h-4 w-4" />
          Receive item
        </Link>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Clock} label="Awaiting appraisal" value={awaiting.length} />
        <Kpi icon={AlertTriangle} label="Due within 3 days" value={dueSoon.length} tone="amber" />
        <Kpi icon={AlertTriangle} label="Overdue" value={overdue.length} tone="red" />
        <Kpi icon={Archive} label="In custody" value={inCustody.length} />
      </div>

      {/* Reminder */}
      {myAttention.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {myAttention.length} item{myAttention.length > 1 ? "s" : ""} need
            {myAttention.length > 1 ? "" : "s"} an appraisal decision
            {profile.role === "admin" ? "" : " from you"}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {myAttention.slice(0, 6).map((r) => (
              <Link
                key={r.id}
                href={`/consignments/items/${r.id}`}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100 dark:bg-neutral-900 dark:text-amber-300 dark:ring-amber-700/50"
              >
                {r.reference} · {r.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Table / search / filters */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <Package className="mx-auto mb-3 h-8 w-8 text-neutral-400" />
          <p className="text-sm text-neutral-500">
            No items received yet.{" "}
            <Link href="/consignments/new" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              Receive your first item
            </Link>
            .
          </p>
        </div>
      ) : (
        <ConsignmentsTable rows={rows} />
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  tone?: "neutral" | "amber" | "red";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-neutral-400";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{label}</span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
