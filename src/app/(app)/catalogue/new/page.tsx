import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getHostAdapters } from "@live-auction/adapters";
import { AuctionCreator, type InventoryItem } from "@live-auction/components/AuctionCreator";
import { AUCTIONABLE_STATUSES } from "@/lib/consignments";

export default async function NewAuctionPage() {
  const adapters = await getHostAdapters();
  const user = await adapters.getCurrentUser();
  if (!user) redirect("/login");
  try {
    await adapters.assertPermission(user.id, "auction.manage");
  } catch {
    redirect("/catalogue");
  }

  const supabase = await createClient();

  // Items already attached to a lot (exclude so they aren't sold twice).
  const { data: lotRows } = await supabase.schema("auction").from("lots").select("source_ref");
  const used = new Set(
    ((lotRows ?? []) as { source_ref: string | null }[])
      .map((r) => r.source_ref)
      .filter(Boolean) as string[],
  );

  const { data } = await supabase
    .from("consignment_items")
    .select(
      "id, reference, title, reserve_price, consignment:consignments ( consignor:consignors ( full_name ) )",
    )
    .in("status", AUCTIONABLE_STATUSES)
    .order("created_at", { ascending: false });

  const items: InventoryItem[] = (
    (data ?? []) as unknown as {
      id: string;
      reference: string;
      title: string;
      reserve_price: number | null;
      consignment: { consignor: { full_name: string } | null } | null;
    }[]
  )
    .filter((r) => !used.has(r.id))
    .map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      reserve_price: r.reserve_price,
      consignor: r.consignment?.consignor?.full_name ?? null,
    }));

  return (
    <div>
      <Link
        href="/catalogue"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Catalogue &amp; Lots
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New auction</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick inventory and set the sale details — each item becomes a lot. Items
          appear once they&apos;re accepted, cataloged, or routed to auction (set the status
          from Inventory).
        </p>
      </div>
      <AuctionCreator items={items} />
    </div>
  );
}
