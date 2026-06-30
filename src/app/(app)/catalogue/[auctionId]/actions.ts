"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertManager() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "staff") {
    throw new Error("Not authorized");
  }
  return profile;
}

export type ParticipantInput =
  | { clientId: string }
  | { name: string; email?: string; phone?: string };

/**
 * Register a Client as a participant (auto-approved). If `name` is given
 * instead of `clientId`, the client is created first.
 */
export async function addParticipant(auctionId: string, input: ParticipantInput) {
  await assertManager();
  const admin = createAdminClient();

  let clientId: string;
  if ("clientId" in input) {
    clientId = input.clientId;
  } else {
    const name = input.name.trim();
    if (!name) return { error: "Enter the client's name." };
    const { data: client, error: cErr } = await admin
      .from("consignors")
      .insert({
        full_name: name,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
      })
      .select("id")
      .single();
    if (cErr || !client) return { error: `Could not create client: ${cErr?.message}` };
    clientId = client.id;
  }

  // Manual upsert: avoid ON CONFLICT (the uniqueness is enforced by a partial
  // index, which the PostgREST onConflict target can't reference).
  const { data: existing } = await admin
    .schema("auction")
    .from("registrations")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) {
    await admin
      .schema("auction")
      .from("registrations")
      .update({ status: "approved" })
      .eq("id", existing.id);
  } else {
    const { error } = await admin
      .schema("auction")
      .from("registrations")
      .insert({ auction_id: auctionId, client_id: clientId, status: "approved" });
    if (error) return { error: error.message };
  }

  revalidatePath(`/catalogue/${auctionId}`);
  return { ok: true };
}

/** Remove a participant from an auction. */
export async function removeParticipant(auctionId: string, registrationId: string) {
  await assertManager();
  const admin = createAdminClient();
  const { error } = await admin
    .schema("auction")
    .from("registrations")
    .delete()
    .eq("id", registrationId);
  if (error) return { error: error.message };
  revalidatePath(`/catalogue/${auctionId}`);
  return { ok: true };
}

/** Delete an auction (cascades to its lots & registrations). */
export async function deleteAuction(auctionId: string) {
  await assertManager();
  const admin = createAdminClient();
  await admin.schema("auction").from("auctions").delete().eq("id", auctionId);
  redirect("/catalogue");
}
