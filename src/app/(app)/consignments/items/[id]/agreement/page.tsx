import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";
import { formatDate, formatMoney } from "@/lib/consignments";

export default async function AgreementPage({
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
      `reference, title, description, category, lot_barcode, routing_track,
       seller_commission, reserve_price, asking_price, private_sale_months,
       agreement_number, agreement_generated_at,
       consignment:consignments ( reference, consignor:consignors ( full_name, email, phone, address ) ),
       auction:auctions ( name, sale_date, location )`,
    )
    .eq("id", id)
    .single();

  if (!item) notFound();

  const consignment = item.consignment as unknown as {
    reference: string;
    consignor: {
      full_name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
    } | null;
  } | null;
  const consignor = consignment?.consignor ?? null;
  const auction = item.auction as unknown as {
    name: string;
    sale_date: string | null;
    location: string | null;
  } | null;
  const isAuction = item.routing_track === "auction";
  const isPrivate = item.routing_track === "private";

  if (!item.agreement_number) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/consignments/items/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to item
        </Link>
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No consignment agreement has been generated for this item yet. Accept
          it to auction or private sale in the Appraisal module to generate one.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/consignments/items/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to item
        </Link>
        <PrintButton label="Print agreement" />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-neutral-900 shadow-sm print:border-0 print:p-0 print:shadow-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:print:bg-white dark:print:text-black">
        <div className="mb-8 flex items-start justify-between border-b border-neutral-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white">
                A
              </span>
              <span className="text-lg font-semibold">AlBahie Auction House</span>
            </div>
            <p className="mt-2 text-sm text-neutral-500">Consignment Agreement</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-mono font-semibold">{item.agreement_number}</p>
            <p className="text-neutral-500">
              {formatDate(item.agreement_generated_at)}
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
              Sale method
            </h3>
            <p className="font-medium">
              {isAuction ? "Auction (Public Sale)" : isPrivate ? "Private Sale (Direct Brokerage)" : "—"}
            </p>
            {isAuction && auction && (
              <>
                <p className="text-neutral-500">{auction.name}</p>
                {auction.sale_date && (
                  <p className="text-neutral-500">{formatDate(auction.sale_date)}</p>
                )}
              </>
            )}
          </div>
        </div>

        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Property
        </h3>
        <div className="mb-8 rounded-xl border border-neutral-200 p-4 text-sm">
          <p className="font-medium">{item.title}</p>
          <p className="font-mono text-xs text-neutral-500">{item.reference}</p>
          {item.category && (
            <p className="text-xs text-neutral-500">{item.category}</p>
          )}
          {item.description && (
            <p className="mt-2 text-neutral-600">{item.description}</p>
          )}
        </div>

        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Commercial terms
        </h3>
        <table className="mb-8 w-full text-sm">
          <tbody className="divide-y divide-neutral-100">
            <Term
              label="Seller commission"
              value={
                item.seller_commission != null
                  ? `${item.seller_commission}%`
                  : "—"
              }
            />
            {isAuction && (
              <Term label="Reserve price" value={formatMoney(item.reserve_price)} />
            )}
            {isPrivate && (
              <>
                <Term label="Asking price" value={formatMoney(item.asking_price)} />
                <Term
                  label="Private sale period"
                  value={
                    item.private_sale_months
                      ? `${item.private_sale_months} months`
                      : "—"
                  }
                />
              </>
            )}
          </tbody>
        </table>

        <p className="mb-8 text-xs leading-relaxed text-neutral-500">
          The consignor authorises AlBahie Auction House to offer the above property
          for sale on the terms stated. The auction house will remit the net
          proceeds to the consignor following sale and settlement, less the
          agreed commission and any applicable charges. This agreement confirms
          custody and the agreed terms of sale.
        </p>

        <div className="grid grid-cols-2 gap-8 border-t border-neutral-200 pt-6 text-sm">
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
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-2 text-neutral-500">{label}</td>
      <td className="py-2 text-right font-medium">{value}</td>
    </tr>
  );
}
