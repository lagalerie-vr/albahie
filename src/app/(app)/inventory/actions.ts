"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { STATUS_META, type ConsignmentStatus } from "@/lib/consignments";

export type LocationResult = { error?: string };

/** Change an inventory item's status and log it to the item history. */
export async function setItemStatus(
  itemId: string,
  status: ConsignmentStatus,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("consignment_items")
    .select("status")
    .eq("id", itemId)
    .single();
  const from = (current?.status as ConsignmentStatus) ?? null;
  if (from === status) return {};

  const { error } = await supabase
    .from("consignment_items")
    .update({ status })
    .eq("id", itemId);
  if (error) return { error: error.message };

  await supabase.from("item_activity").insert({
    item_id: itemId,
    kind: "status",
    summary: "Status changed",
    detail: `${from ? STATUS_META[from].label : "—"} → ${STATUS_META[status].label}`,
    actor: profile.id,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/items/${itemId}`);
  revalidatePath(`/consignments/items/${itemId}`);
  return {};
}

export async function updateLocation(
  itemId: string,
  location: string,
  note?: string,
): Promise<LocationResult> {
  const trimmed = location?.trim();
  if (!trimmed) return { error: "A location is required." };

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("consignment_items")
    .select("location")
    .eq("id", itemId)
    .single();

  const from = current?.location ?? "—";
  if (from === trimmed && !note?.trim()) {
    return { error: "That is already the current location." };
  }

  const { error } = await supabase
    .from("consignment_items")
    .update({ location: trimmed })
    .eq("id", itemId);
  if (error) return { error: error.message };

  await supabase.from("item_activity").insert({
    item_id: itemId,
    kind: "location",
    summary: "Location changed",
    detail: `${from} → ${trimmed}${note?.trim() ? ` (${note.trim()})` : ""}`,
    actor: profile.id,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/items/${itemId}`);
  revalidatePath(`/consignments/items/${itemId}`);
  return {};
}
