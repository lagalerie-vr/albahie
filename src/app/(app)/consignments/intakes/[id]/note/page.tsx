import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { CodeLabel } from "@/components/CodeLabel";
import { PrintButton } from "@/components/PrintButton";
import { formatDate } from "@/lib/consignments";

export default async function DeliveryNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const { data: consignment } = await supabase
    .from("consignments")
    .select(
      `id, reference, delivery_note_number, received_at, notes,
       consignor:consignors ( full_name, email, phone, address ),
       received_by_profile:profiles!consignments_received_by_fkey ( full_name, email ),
       items:consignment_items ( id, reference, lot_barcode, title, category, height_cm, width_cm, depth_cm, weight_kg,
         photos:consignment_item_photos ( storage_path, is_primary ) )`,
    )
    .eq("id", id)
    .single();

  if (!consignment) notFound();

  // Supabase infers embedded relations loosely without generated types; cast.
  const consignor = consignment.consignor as unknown as {
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  const receivedBy = consignment.received_by_profile as unknown as {
    full_name: string | null;
    email: string;
  } | null;
  const items = (consignment.items ?? []) as unknown as Array<{
    id: string;
    reference: string;
    lot_barcode: string;
    title: string;
    category: string | null;
    height_cm: number | null;
    width_cm: number | null;
    depth_cm: number | null;
    weight_kg: number | null;
    photos: { storage_path: string; is_primary: boolean }[];
  }>;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const photoUrl = (
    photos: { storage_path: string; is_primary: boolean }[],
  ): string | null => {
    if (!photos || photos.length === 0) return null;
    const chosen = photos.find((p) => p.is_primary) ?? photos[0];
    return supabase.storage
      .from("consignment-photos")
      .getPublicUrl(chosen.storage_path).data.publicUrl;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/consignments"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Consignments
        </Link>
        <PrintButton label="Print delivery note" />
      </div>

      {/* The printable document */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-neutral-900 shadow-sm print:border-0 print:p-0 print:shadow-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:print:bg-white dark:print:text-black">
        <div className="mb-8 flex items-start justify-between border-b border-neutral-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white">
                A
              </span>
              <span className="text-lg font-semibold">AlBahie Auction House</span>
            </div>
            <p className="mt-2 text-sm text-neutral-500">Delivery Note</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-mono font-semibold">
              {consignment.delivery_note_number}
            </p>
            <p className="text-neutral-500">Intake {consignment.reference}</p>
            <p className="mt-1 text-neutral-500">
              {formatDate(consignment.received_at)}
            </p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Consignor
            </h3>
            <p className="font-medium">{consignor?.full_name}</p>
            {consignor?.email && <p className="text-neutral-500">{consignor.email}</p>}
            {consignor?.phone && <p className="text-neutral-500">{consignor.phone}</p>}
            {consignor?.address && (
              <p className="text-neutral-500">{consignor.address}</p>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Received by
            </h3>
            <p className="font-medium">
              {receivedBy?.full_name || receivedBy?.email || "—"}
            </p>
            <p className="text-neutral-500">{formatDate(consignment.received_at)}</p>
          </div>
        </div>

        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Items received ({items.length})
        </h3>
        <div className="space-y-4">
          {items.map((it) => {
            const img = photoUrl(it.photos);
            return (
              <div
                key={it.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-4"
              >
                <div className="flex items-center gap-4">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={it.title}
                      className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-neutral-200"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-[10px] text-neutral-400 ring-1 ring-neutral-200">
                      No photo
                    </div>
                  )}
                  <div className="text-sm">
                    <p className="font-medium">{it.title}</p>
                    <p className="font-mono text-xs text-neutral-500">
                      {it.reference}
                    </p>
                    {it.category && (
                      <p className="text-xs text-neutral-500">{it.category}</p>
                    )}
                    <p className="mt-1 text-xs text-neutral-500">{dims(it)}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <CodeLabel
                    value={it.lot_barcode}
                    url={`${siteUrl}/consignments/items/${it.id}`}
                    size={96}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {consignment.notes && (
          <div className="mt-6 text-sm">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Notes
            </h3>
            <p className="text-neutral-600">{consignment.notes}</p>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-8 border-t border-neutral-200 pt-6 text-sm">
          <div>
            <div className="h-12 border-b border-neutral-300" />
            <p className="mt-1 text-xs text-neutral-500">Consignor signature</p>
          </div>
          <div>
            <div className="h-12 border-b border-neutral-300" />
            <p className="mt-1 text-xs text-neutral-500">
              Auction house representative
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          This delivery note confirms the auction house has taken the above
          property into custody for appraisal.
        </p>
      </div>
    </div>
  );
}

function dims(it: {
  height_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  weight_kg: number | null;
}): string {
  const parts: string[] = [];
  if (it.height_cm != null) parts.push(`H ${it.height_cm}`);
  if (it.width_cm != null) parts.push(`W ${it.width_cm}`);
  if (it.depth_cm != null) parts.push(`D ${it.depth_cm}`);
  const dim = parts.length ? parts.join(" × ") + " cm" : "";
  const wt = it.weight_kg != null ? `${it.weight_kg} kg` : "";
  return [dim, wt].filter(Boolean).join(" · ") || "No dimensions recorded";
}
