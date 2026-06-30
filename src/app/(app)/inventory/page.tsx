import { Boxes, Archive, Clock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  InventoryTable,
  type InventoryListItem,
} from "@/components/inventory/InventoryTable";
import type { ConsignmentStatus } from "@/lib/consignments";

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

export default async function InventoryPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("consignment_items")
    .select(
      `id, reference, title, category, status, location,
       consignment:consignments ( consignor:consignors ( full_name ) ),
       photos:consignment_item_photos ( storage_path, is_primary )`,
    )
    .order("created_at", { ascending: false });

  const rows = ((data ?? []) as unknown as (InventoryListItem & {
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
    } as InventoryListItem;
  });

  const inCustody = rows.filter((r) => IN_CUSTODY.includes(r.status)).length;
  const awaiting = rows.filter(
    (r) => r.status === "awaiting_appraisal" || r.status === "extended_review",
  ).length;
  const locations = new Set(rows.map((r) => r.location)).size;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every item, where it is, and a full history of changes.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Boxes} label="Total items" value={rows.length} />
        <Kpi icon={Archive} label="In custody" value={inCustody} />
        <Kpi icon={Clock} label="Awaiting appraisal" value={awaiting} />
        <Kpi icon={MapPin} label="Locations in use" value={locations} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <Boxes className="mx-auto mb-3 h-8 w-8 text-neutral-400" />
          <p className="text-sm text-neutral-500">
            No items in inventory yet.
          </p>
        </div>
      ) : (
        <InventoryTable rows={rows} />
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{label}</span>
        <Icon className="h-4 w-4 text-neutral-400" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
