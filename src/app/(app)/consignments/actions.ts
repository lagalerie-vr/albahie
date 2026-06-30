"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type IntakeState = { error: string } | null;

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? null : raw;
}

export async function createIntake(
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = str(formData, "title");
  if (!title) return { error: "Item title is required." };

  // ---- Consignor: existing, matched, or new --------------------------------
  let consignorId = str(formData, "consignor_id");
  if (!consignorId) {
    const consignorName = str(formData, "consignor_name");
    if (!consignorName) {
      return { error: "Select an existing consignor or enter a new one." };
    }

    const email = str(formData, "consignor_email");
    const phone = str(formData, "consignor_phone");

    // De-dupe safety net: reuse an existing consignor matched by email or phone
    // (case-insensitive) so the same person isn't stored twice.
    if (email) {
      const { data: byEmail } = await supabase
        .from("consignors")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (byEmail) consignorId = byEmail.id;
    }
    if (!consignorId && phone) {
      const { data: byPhone } = await supabase
        .from("consignors")
        .select("id")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      if (byPhone) consignorId = byPhone.id;
    }

    if (!consignorId) {
      const { data: consignor, error: cErr } = await supabase
        .from("consignors")
        .insert({
          full_name: consignorName,
          email,
          phone,
          address: str(formData, "consignor_address"),
        })
        .select("id")
        .single();
      if (cErr || !consignor) {
        return { error: `Could not create consignor: ${cErr?.message}` };
      }
      consignorId = consignor.id;
    }
  }

  // ---- Consignment (intake / delivery note) --------------------------------
  const receivedAtRaw = str(formData, "received_at");
  const receivedAt = receivedAtRaw
    ? new Date(receivedAtRaw).toISOString()
    : new Date().toISOString();

  const { data: consignment, error: conErr } = await supabase
    .from("consignments")
    .insert({
      consignor_id: consignorId,
      received_by: profile.id,
      received_at: receivedAt,
      notes: str(formData, "notes"),
    })
    .select("id")
    .single();
  if (conErr || !consignment) {
    return { error: `Could not create consignment: ${conErr?.message}` };
  }

  // ---- Item ----------------------------------------------------------------
  const { data: item, error: itemErr } = await supabase
    .from("consignment_items")
    .insert({
      consignment_id: consignment.id,
      title,
      description: str(formData, "description"),
      category: str(formData, "category"),
      height_cm: num(formData, "height_cm"),
      width_cm: num(formData, "width_cm"),
      depth_cm: num(formData, "depth_cm"),
      weight_kg: num(formData, "weight_kg"),
      responsible_manager: str(formData, "responsible_manager") ?? profile.id,
      received_at: receivedAt,
      // status defaults to 'awaiting_appraisal'; appraisal_due_at set by trigger
    })
    .select("id")
    .single();
  if (itemErr || !item) {
    return { error: `Could not create item: ${itemErr?.message}` };
  }

  // ---- Photos --------------------------------------------------------------
  // Files were uploaded to storage by the browser; we just record their paths.
  let photoPaths: string[] = [];
  try {
    const raw = str(formData, "photo_paths");
    if (raw) photoPaths = JSON.parse(raw) as string[];
  } catch {
    photoPaths = [];
  }

  if (photoPaths.length > 0) {
    await supabase.from("consignment_item_photos").insert(
      photoPaths.map((storage_path, i) => ({
        item_id: item.id,
        storage_path,
        is_primary: i === 0,
      })),
    );
  }

  await supabase.from("item_activity").insert({
    item_id: item.id,
    kind: "received",
    summary: "Item received into inventory",
    detail: "Holding Tray",
    actor: profile.id,
  });

  revalidatePath("/consignments");
  redirect(`/consignments/items/${item.id}`);
}

export async function deleteConsignment(
  consignmentId: string,
): Promise<{ error: string } | void> {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    return { error: "Only administrators can delete consignments." };
  }
  const supabase = await createClient();

  // Remove all photo objects from storage first (DB rows cascade on delete).
  const { data: items } = await supabase
    .from("consignment_items")
    .select("id, consignment_item_photos ( storage_path )")
    .eq("consignment_id", consignmentId);

  const paths: string[] = [];
  for (const it of (items ?? []) as unknown as {
    consignment_item_photos: { storage_path: string }[];
  }[]) {
    for (const p of it.consignment_item_photos ?? []) paths.push(p.storage_path);
  }
  if (paths.length > 0) {
    await supabase.storage.from("consignment-photos").remove(paths);
  }

  const { error } = await supabase
    .from("consignments")
    .delete()
    .eq("id", consignmentId);
  if (error) return { error: `Could not delete: ${error.message}` };

  revalidatePath("/consignments");
  redirect("/consignments");
}

function jsonArray(formData: FormData, key: string): string[] {
  try {
    const raw = str(formData, key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function updateIntake(
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const itemId = str(formData, "item_id");
  const consignmentId = str(formData, "consignment_id");
  const consignorId = str(formData, "consignor_id");
  if (!itemId || !consignmentId) return { error: "Missing item reference." };

  const title = str(formData, "title");
  if (!title) return { error: "Item title is required." };

  // ---- Consignor details ---------------------------------------------------
  if (consignorId) {
    const consignorName = str(formData, "consignor_name");
    if (!consignorName) return { error: "Consignor name is required." };
    const { error } = await supabase
      .from("consignors")
      .update({
        full_name: consignorName,
        email: str(formData, "consignor_email"),
        phone: str(formData, "consignor_phone"),
        address: str(formData, "consignor_address"),
      })
      .eq("id", consignorId);
    if (error) return { error: `Could not update consignor: ${error.message}` };
  }

  // ---- Consignment ---------------------------------------------------------
  const receivedAtRaw = str(formData, "received_at");
  const receivedAt = receivedAtRaw
    ? new Date(receivedAtRaw).toISOString()
    : undefined;

  const { error: conErr } = await supabase
    .from("consignments")
    .update({
      ...(receivedAt ? { received_at: receivedAt } : {}),
      notes: str(formData, "notes"),
    })
    .eq("id", consignmentId);
  if (conErr) return { error: `Could not update consignment: ${conErr.message}` };

  // ---- Item ----------------------------------------------------------------
  // Capture current values to compute what changed (for the activity log).
  const { data: before } = await supabase
    .from("consignment_items")
    .select(
      "title, description, category, height_cm, width_cm, depth_cm, weight_kg",
    )
    .eq("id", itemId)
    .single();

  const next = {
    title,
    description: str(formData, "description"),
    category: str(formData, "category"),
    height_cm: num(formData, "height_cm"),
    width_cm: num(formData, "width_cm"),
    depth_cm: num(formData, "depth_cm"),
    weight_kg: num(formData, "weight_kg"),
  };

  const { error: itemErr } = await supabase
    .from("consignment_items")
    .update({
      ...next,
      responsible_manager: str(formData, "responsible_manager"),
      ...(receivedAt ? { received_at: receivedAt } : {}),
    })
    .eq("id", itemId);
  if (itemErr) return { error: `Could not update item: ${itemErr.message}` };

  const changedFields: string[] = [];
  if (before) {
    const labels: Record<string, string> = {
      title: "title",
      description: "description",
      category: "category",
      height_cm: "height",
      width_cm: "width",
      depth_cm: "depth",
      weight_kg: "weight",
    };
    for (const k of Object.keys(next) as (keyof typeof next)[]) {
      if ((before as Record<string, unknown>)[k] !== next[k]) {
        changedFields.push(labels[k]);
      }
    }
  }

  // ---- Remove photos -------------------------------------------------------
  const removedIds = jsonArray(formData, "removed_photo_ids");
  if (removedIds.length > 0) {
    const { data: toRemove } = await supabase
      .from("consignment_item_photos")
      .select("id, storage_path")
      .in("id", removedIds);
    if (toRemove && toRemove.length > 0) {
      await supabase.storage
        .from("consignment-photos")
        .remove(toRemove.map((p) => p.storage_path));
      await supabase
        .from("consignment_item_photos")
        .delete()
        .in(
          "id",
          toRemove.map((p) => p.id),
        );
    }
  }

  // ---- Add new photos ------------------------------------------------------
  const newPaths = jsonArray(formData, "new_photo_paths");
  if (newPaths.length > 0) {
    await supabase.from("consignment_item_photos").insert(
      newPaths.map((storage_path) => ({
        item_id: itemId,
        storage_path,
        is_primary: false,
      })),
    );
  }

  // ---- Ensure exactly one primary photo remains ----------------------------
  const { data: remaining } = await supabase
    .from("consignment_item_photos")
    .select("id, is_primary")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });
  if (remaining && remaining.length > 0 && !remaining.some((p) => p.is_primary)) {
    await supabase
      .from("consignment_item_photos")
      .update({ is_primary: true })
      .eq("id", remaining[0].id);
  }

  // ---- Log the update ------------------------------------------------------
  const photoNotes: string[] = [];
  if (newPaths.length > 0)
    photoNotes.push(`${newPaths.length} photo${newPaths.length > 1 ? "s" : ""} added`);
  if (removedIds.length > 0)
    photoNotes.push(
      `${removedIds.length} photo${removedIds.length > 1 ? "s" : ""} removed`,
    );
  const detailParts = [...changedFields, ...photoNotes];
  if (detailParts.length > 0) {
    await supabase.from("item_activity").insert({
      item_id: itemId,
      kind: "updated",
      summary: "Details updated",
      detail: detailParts.join(", "),
      actor: profile.id,
    });
  }

  revalidatePath("/consignments");
  revalidatePath(`/consignments/items/${itemId}`);
  redirect(`/consignments/items/${itemId}`);
}
