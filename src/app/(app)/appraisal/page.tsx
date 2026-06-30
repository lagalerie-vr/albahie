import { Scale, AlertTriangle, Clock, CalendarPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AppraisalTabs } from "@/components/appraisal/AppraisalTabs";
import type { QueueItem } from "@/components/appraisal/AppraisalQueue";
import type { HistoryItem } from "@/components/appraisal/AppraisalHistory";
import { appraisalUrgency } from "@/lib/consignments";

type WithPhotos<T> = T & {
  photos: { storage_path: string; is_primary: boolean }[];
};

export default async function AppraisalPage() {
  await requireProfile();
  const supabase = await createClient();

  const withPhotoUrl = <T extends { photos: { storage_path: string; is_primary: boolean }[] }>(
    rows: T[],
  ) =>
    rows.map((r) => {
      const photos = r.photos ?? [];
      const chosen = photos.find((p) => p.is_primary) ?? photos[0];
      const { ...rest } = r;
      return {
        ...rest,
        photo_url: chosen
          ? supabase.storage
              .from("consignment-photos")
              .getPublicUrl(chosen.storage_path).data.publicUrl
          : null,
      };
    });

  const [{ data: queueData }, { data: historyData }] = await Promise.all([
    supabase
      .from("consignment_items")
      .select(
        `id, reference, title, category, status, appraisal_due_at, extension_count,
         consignment:consignments ( consignor:consignors ( full_name ) ),
         manager:profiles!consignment_items_responsible_manager_fkey ( full_name, email ),
         photos:consignment_item_photos ( storage_path, is_primary )`,
      )
      .in("status", ["awaiting_appraisal", "extended_review"])
      .order("appraisal_due_at", { ascending: true }),
    supabase
      .from("consignment_items")
      .select(
        `id, reference, title, category, status, appraisal_decided_at, routing_track,
         consignment:consignments ( consignor:consignors ( full_name ) ),
         decided_by_profile:profiles!consignment_items_appraisal_decided_by_fkey ( full_name, email ),
         auction:auctions ( name ),
         photos:consignment_item_photos ( storage_path, is_primary )`,
      )
      .not("appraisal_decided_at", "is", null)
      .order("appraisal_decided_at", { ascending: false }),
  ]);

  const queue = withPhotoUrl(
    (queueData ?? []) as unknown as WithPhotos<QueueItem>[],
  ) as QueueItem[];
  const history = withPhotoUrl(
    (historyData ?? []) as unknown as WithPhotos<HistoryItem>[],
  ) as HistoryItem[];

  const overdue = queue.filter(
    (i) => appraisalUrgency(i.status, i.appraisal_due_at) === "overdue",
  ).length;
  const soon = queue.filter(
    (i) => appraisalUrgency(i.status, i.appraisal_due_at) === "soon",
  ).length;
  const extended = queue.filter((i) => i.status === "extended_review").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Appraisal</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every item in the holding tray has a forced next step. Decide: accept,
          reject, or extend.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Scale} label="Awaiting decision" value={queue.length} />
        <Kpi icon={AlertTriangle} label="Overdue" value={overdue} tone="red" />
        <Kpi icon={Clock} label="Due within 3 days" value={soon} tone="amber" />
        <Kpi icon={CalendarPlus} label="On extension" value={extended} />
      </div>

      <AppraisalTabs queue={queue} history={history} />
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
