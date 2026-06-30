"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type CreateState = { error: string } | null;

/**
 * Create an `auction.auctions` row + `auction.lots` from selected inventory
 * items (consignment items routed to the auction track). Each lot keeps
 * `source_ref` = item id so the sale result can flow back to the host item.
 */
export async function createAuction(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "staff") {
    return { error: "You do not have permission to create auctions." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "").trim();
  const softClose = Number(formData.get("soft_close") ?? 30) || 30;
  const ids = formData.getAll("item_ids").map(String).filter(Boolean);

  if (!title) return { error: "Enter an auction title." };

  const supabase = await createClient();

  const { data: auction, error: aErr } = await supabase
    .schema("auction")
    .from("auctions")
    .insert({
      title,
      status: "scheduled",
      starts_at: dateRaw ? new Date(dateRaw).toISOString() : null,
      soft_close_seconds: softClose,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (aErr || !auction) {
    return { error: `Could not create auction: ${aErr?.message}` };
  }

  if (ids.length > 0) {
    const { data: items } = await supabase
      .from("consignment_items")
      .select("id, title, description, reserve_price, asking_price")
      .in("id", ids);

    const lots = (items ?? []).map((it, i) => ({
      auction_id: auction.id,
      lot_no: i + 1,
      title: it.title,
      description: it.description,
      reserve_cents:
        it.reserve_price != null ? Math.round(Number(it.reserve_price) * 100) : null,
      start_price_cents:
        it.asking_price != null ? Math.round(Number(it.asking_price) * 100) : 0,
      source_ref: it.id,
      sort_order: i,
    }));
    if (lots.length > 0) {
      const { error: lErr } = await supabase
        .schema("auction")
        .from("lots")
        .insert(lots);
      if (lErr) return { error: `Auction created, but lots failed: ${lErr.message}` };
    }
  }

  redirect(`/catalogue/${auction.id}`);
}
