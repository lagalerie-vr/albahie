import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getHostAdapters } from "@live-auction/adapters";
import { AuctionManager } from "@live-auction/components/AuctionManager";
import type { Auction, Client } from "@live-auction/lib/types";

export default async function ManageAuctionPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  const adapters = await getHostAdapters();
  const user = await adapters.getCurrentUser();
  if (!user) redirect("/login");
  try {
    await adapters.assertPermission(user.id, "auction.manage");
  } catch {
    redirect("/catalogue");
  }

  const supabase = await createClient();
  const { data: auction } = await supabase
    .schema("auction")
    .from("auctions")
    .select("*")
    .eq("id", auctionId)
    .single();
  if (!auction) notFound();

  const { data: clientRows } = await supabase
    .from("consignors")
    .select("id, full_name, email, phone")
    .order("full_name", { ascending: true });
  const clients = (clientRows ?? []) as Client[];

  return (
    <div>
      <Link
        href="/catalogue"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Catalogue &amp; Lots
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{auction.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage lots, participants, and sale details.
          </p>
        </div>
        <Link
          href={`/auctions/${auctionId}`}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <Radio className="h-4 w-4" />
          Open control panel
        </Link>
      </div>
      <AuctionManager auction={auction as Auction} clients={clients} />
    </div>
  );
}
