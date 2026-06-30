import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getHostAdapters } from "@live-auction/adapters";
import { ControlPanel } from "@live-auction/components/ControlPanel";

export default async function ControlPanelPage({
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
    redirect("/auctions");
  }

  const supabase = await createClient();
  const { data: auction } = await supabase
    .schema("auction")
    .from("auctions")
    .select("title, status")
    .eq("id", auctionId)
    .single();
  if (!auction) notFound();

  return (
    <div>
      <Link
        href="/auctions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Live Auction
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{auction.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Control panel — streaming and running the sale.
          </p>
        </div>
        <Link
          href={`/catalogue/${auctionId}`}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <Pencil className="h-4 w-4" />
          Edit catalogue
        </Link>
      </div>
      <ControlPanel
        auctionId={auctionId}
        auctionTitle={auction.title}
        initialStatus={auction.status}
      />
    </div>
  );
}
