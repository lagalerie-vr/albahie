import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Client, KycRecord } from "@/lib/clients";
import {
  ClientDetail,
  type SellerItem,
  type BuyerReg,
  type WonLot,
} from "@/components/clients/ClientDetail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireProfile();
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("consignors")
    .select("id, full_name, email, phone, address, notes, created_at")
    .eq("id", id)
    .single();
  if (!client) notFound();

  const [{ data: kyc }, { data: items }, { data: regs }] = await Promise.all([
    supabase
      .from("client_kyc")
      .select("*")
      .eq("consignor_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("consignment_items")
      .select("id, reference, title, status, created_at, consignment:consignments!inner ( consignor_id )")
      .eq("consignment.consignor_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .schema("auction")
      .from("registrations")
      .select("id, paddle_no, status, auction:auctions ( id, title )")
      .eq("client_id", id),
  ]);

  const sellerItems = ((items ?? []) as unknown as SellerItem[]).map((r) => ({
    id: r.id,
    reference: r.reference,
    title: r.title,
    status: r.status,
    created_at: r.created_at,
  }));

  const buyerRegs = ((regs ?? []) as unknown as {
    id: string;
    paddle_no: number;
    status: string;
    auction: { id: string; title: string } | null;
  }[]).map((r) => ({
    id: r.id,
    paddle_no: r.paddle_no,
    status: r.status,
    auction_title: r.auction?.title ?? "—",
  })) satisfies BuyerReg[];

  // Lots this client won (high bidder via one of their registrations).
  let wonLots: WonLot[] = [];
  const regIds = (regs ?? []).map((r) => (r as { id: string }).id);
  if (regIds.length > 0) {
    const { data: lots } = await supabase
      .schema("auction")
      .from("lots")
      .select("id, lot_no, title, winning_amount_cents")
      .in("high_bidder_registration", regIds)
      .eq("status", "sold");
    wonLots = ((lots ?? []) as unknown as WonLot[]) ?? [];
  }

  return (
    <div>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>
      <ClientDetail
        client={client as Client}
        kyc={(kyc ?? []) as KycRecord[]}
        sellerItems={sellerItems}
        buyerRegs={buyerRegs}
        wonLots={wonLots}
        canDelete={me.role === "admin"}
      />
    </div>
  );
}
