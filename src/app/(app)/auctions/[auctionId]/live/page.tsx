import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHostAdapters } from "@live-auction/adapters";
import { BidderView } from "@live-auction/components/BidderView";

export default async function LivePage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  const adapters = await getHostAdapters();
  const user = await adapters.getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: auction } = await supabase
    .schema("auction")
    .from("auctions")
    .select("title")
    .eq("id", auctionId)
    .single();
  if (!auction) notFound();

  return <BidderView auctionId={auctionId} auctionTitle={auction.title} />;
}
