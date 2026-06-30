import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Ruler,
  Calendar,
  User,
  Pencil,
  FileSignature,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { CodeLabel } from "@/components/CodeLabel";
import { LightboxImage } from "@/components/LightboxImage";
import { DeleteButton } from "@/components/consignments/DeleteButton";
import {
  ItemHistory,
  type ActivityEntry,
} from "@/components/consignments/ItemHistory";
import {
  appraisalUrgency,
  daysUntil,
  formatDate,
  formatMoney,
  type ConsignmentStatus,
} from "@/lib/consignments";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("consignment_items")
    .select(
      `*, consignment:consignments ( id, reference, delivery_note_number, received_at, consignor:consignors ( full_name, email, phone, address ) ),
       auction:auctions ( name ),
       photos:consignment_item_photos ( id, storage_path, is_primary ),
       item_activity ( id, kind, summary, detail, created_at,
         actor_profile:profiles!item_activity_actor_fkey ( full_name, email ) )`,
    )
    .eq("id", id)
    .single();

  if (!item) notFound();

  const status = item.status as ConsignmentStatus;
  const history = (item.item_activity ?? []) as ActivityEntry[];
  const consignor = item.consignment?.consignor;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const deepLink = `${siteUrl}/consignments/items/${item.id}`;

  const photos = (item.photos ?? []).map(
    (p: { id: string; storage_path: string; is_primary: boolean }) => ({
      ...p,
      url: supabase.storage
        .from("consignment-photos")
        .getPublicUrl(p.storage_path).data.publicUrl,
    }),
  );

  const urgency = appraisalUrgency(status, item.appraisal_due_at);
  const d = daysUntil(item.appraisal_due_at);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/consignments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Consignments
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="font-mono text-sm text-neutral-500">{item.reference}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/consignments/items/${item.id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <Link
            href={`/consignments/intakes/${item.consignment?.id}/note`}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            <FileText className="h-4 w-4" />
            Delivery note
          </Link>
          {item.agreement_number && (
            <Link
              href={`/consignments/items/${item.id}/agreement`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              <FileSignature className="h-4 w-4" />
              Agreement
            </Link>
          )}
          {profile.role === "admin" && item.consignment?.id && (
            <DeleteButton
              consignmentId={item.consignment.id}
              reference={item.reference}
            />
          )}
        </div>
      </div>

      {/* Appraisal window banner */}
      {urgency && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm ${
            urgency === "overdue"
              ? "border-red-300 bg-red-50 text-red-800 dark:border-red-700/50 dark:bg-red-950/40 dark:text-red-300"
              : urgency === "soon"
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300"
                : "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
          }`}
        >
          <span className="font-medium">
            {d !== null && d < 0
              ? `Appraisal overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`
              : d === 0
                ? "Appraisal due today"
                : `Appraisal window: ${d} day${d === 1 ? "" : "s"} remaining`}
          </span>{" "}
          · due {formatDate(item.appraisal_due_at)}
        </div>
      )}

      {/* Declined notice */}
      {status === "declined" && item.decline_reason && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-700/50 dark:bg-red-950/40">
          <p className="font-medium text-red-800 dark:text-red-300">
            Rejected — to be returned to consignor
          </p>
          <p className="mt-1 text-red-700 dark:text-red-400">
            {item.decline_reason}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: photos + details */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Photographs">
            {photos.length === 0 ? (
              <p className="text-sm text-neutral-500">No photographs on file.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p: { id: string; url: string; is_primary: boolean }) => (
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
              <Field
                label="Received"
                value={formatDate(item.received_at)}
                icon={Calendar}
              />
              <div className="sm:col-span-2">
                <Field label="Description" value={item.description} />
              </div>
            </dl>
          </Card>

          <Card title="Dimensions" icon={Ruler}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Field label="Height" value={dim(item.height_cm, "cm")} />
              <Field label="Width" value={dim(item.width_cm, "cm")} />
              <Field label="Depth" value={dim(item.depth_cm, "cm")} />
              <Field label="Weight" value={dim(item.weight_kg, "kg")} />
            </dl>
          </Card>

          <Card title="History log">
            <ItemHistory entries={history} />
          </Card>
        </div>

        {/* Right: codes + consignor */}
        <div className="space-y-6">
          {item.routing_track && (
            <Card title="Sale terms">
              <dl className="space-y-2 text-sm">
                <Field
                  label="Route"
                  value={
                    item.routing_track === "auction"
                      ? "Auction (Public Sale)"
                      : "Private Sale"
                  }
                />
                {item.auction?.name && (
                  <Field label="Auction event" value={item.auction.name} />
                )}
                <Field
                  label="Seller commission"
                  value={
                    item.seller_commission != null
                      ? `${item.seller_commission}%`
                      : null
                  }
                />
                {item.routing_track === "auction" && (
                  <Field
                    label="Reserve price"
                    value={
                      item.reserve_price != null
                        ? formatMoney(item.reserve_price)
                        : null
                    }
                  />
                )}
                {item.routing_track === "private" && (
                  <>
                    <Field
                      label="Asking price"
                      value={
                        item.asking_price != null
                          ? formatMoney(item.asking_price)
                          : null
                      }
                    />
                    <Field
                      label="Sale period"
                      value={
                        item.private_sale_months
                          ? `${item.private_sale_months} months`
                          : null
                      }
                    />
                  </>
                )}
              </dl>
              {item.agreement_number && (
                <Link
                  href={`/consignments/items/${item.id}/agreement`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  <FileSignature className="h-4 w-4" />
                  {item.agreement_number}
                </Link>
              )}
            </Card>
          )}

          <Card title="Label">
            <CodeLabel value={item.lot_barcode} url={deepLink} />
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
                {consignor.address && (
                  <p className="text-neutral-500">{consignor.address}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">—</p>
            )}
          </Card>

          <Card title="Delivery note">
            <p className="font-mono text-sm">
              {item.consignment?.delivery_note_number}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Intake {item.consignment?.reference}
            </p>
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

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon?: typeof Calendar;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-neutral-400">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

function dim(v: number | null, unit: string): string | null {
  return v == null ? null : `${v} ${unit}`;
}
