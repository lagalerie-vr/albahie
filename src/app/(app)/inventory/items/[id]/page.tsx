import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ruler, User, ExternalLink, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { CodeLabel } from "@/components/CodeLabel";
import { LightboxImage } from "@/components/LightboxImage";
import { LocationControl } from "@/components/inventory/LocationControl";
import {
  ItemHistory,
  type ActivityEntry,
} from "@/components/consignments/ItemHistory";
import { formatDate, type ConsignmentStatus } from "@/lib/consignments";

export default async function InventoryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("consignment_items")
    .select(
      `*, consignment:consignments ( id, reference, consignor:consignors ( full_name, email, phone ) ),
       photos:consignment_item_photos ( id, storage_path, is_primary ),
       item_activity ( id, kind, summary, detail, created_at,
         actor_profile:profiles!item_activity_actor_fkey ( full_name, email ) )`,
    )
    .eq("id", id)
    .single();

  if (!item) notFound();

  const status = item.status as ConsignmentStatus;
  const consignor = item.consignment?.consignor;
  const photos = (item.photos ?? []).map(
    (p: { id: string; storage_path: string }) => ({
      id: p.id,
      url: supabase.storage
        .from("consignment-photos")
        .getPublicUrl(p.storage_path).data.publicUrl,
    }),
  );
  const history = (item.item_activity ?? []) as ActivityEntry[];

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/inventory"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Inventory
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {item.title}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="font-mono text-sm text-neutral-500">{item.reference}</p>
        </div>
        <Link
          href={`/consignments/items/${item.id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <ExternalLink className="h-4 w-4" />
          Full record
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Photographs">
            {photos.length === 0 ? (
              <p className="text-sm text-neutral-500">No photographs on file.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p: { id: string; url: string }) => (
                  <LightboxImage
                    key={p.id}
                    src={p.url}
                    alt={item.title}
                    className="aspect-square w-full rounded-lg object-cover ring-1 ring-neutral-200 dark:ring-neutral-800"
                  />
                ))}
              </div>
            )}
          </Card>

          <Card title="Details">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Category" value={item.category} />
              <Field label="Received" value={formatDate(item.received_at)} />
              <Field label="Dimensions" value={dims(item)} />
              <Field
                label="Weight"
                value={item.weight_kg != null ? `${item.weight_kg} kg` : null}
              />
              {item.description && (
                <div className="sm:col-span-2">
                  <Field label="Description" value={item.description} />
                </div>
              )}
            </dl>
          </Card>

          <Card title="History log">
            <ItemHistory entries={history} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Location" icon={MapPin}>
            <LocationControl itemId={item.id} current={item.location} />
          </Card>

          <Card title="Label">
            <CodeLabel value={item.lot_barcode} />
          </Card>

          <Card title="Consignor" icon={User}>
            {consignor ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{consignor.full_name}</p>
                {consignor.email && (
                  <p className="text-neutral-500">{consignor.email}</p>
                )}
                {consignor.phone && (
                  <p className="text-neutral-500">{consignor.phone}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">—</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Ruler;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
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
