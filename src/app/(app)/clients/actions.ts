"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";

export type CreateClientState = { error: string } | null;

function clean(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function createClientRecord(
  _prev: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  await requireProfile();
  const full_name = String(formData.get("full_name") ?? "").trim();
  if (!full_name) return { error: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consignors")
    .insert({
      full_name,
      email: clean(formData.get("email")),
      phone: clean(formData.get("phone")),
      address: clean(formData.get("address")),
      notes: clean(formData.get("notes")),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create client." };
  redirect(`/clients/${data.id}`);
}

export async function updateClientRecord(
  id: string,
  patch: { full_name: string; email: string; phone: string; address: string; notes: string },
) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("consignors")
    .update({
      full_name: patch.full_name.trim(),
      email: patch.email.trim() || null,
      phone: patch.phone.trim() || null,
      address: patch.address.trim() || null,
      notes: patch.notes.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

export async function addKyc(
  consignorId: string,
  fields: {
    doc_type: string;
    doc_number: string;
    doc_country: string;
    expires_at: string;
    notes: string;
    file_path?: string | null;
  },
) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("client_kyc").insert({
    consignor_id: consignorId,
    doc_type: fields.doc_type,
    doc_number: fields.doc_number.trim() || null,
    doc_country: fields.doc_country.trim() || null,
    expires_at: fields.expires_at || null,
    notes: fields.notes.trim() || null,
    file_path: fields.file_path || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/clients/${consignorId}`);
  return { ok: true };
}

/** Delete a client. Admin-only; blocked if they have consignment history. */
export async function deleteClientRecord(id: string) {
  const profile = await requireProfile();
  if (profile.role !== "admin") return { error: "Only an admin can delete clients." };

  const admin = createAdminClient();
  const { count } = await admin
    .from("consignments")
    .select("id", { count: "exact", head: true })
    .eq("consignor_id", id);
  if ((count ?? 0) > 0) {
    return {
      error: "This client has consignment history and can't be deleted. Archive instead.",
    };
  }

  // Remove KYC document files first (rows cascade on delete).
  const { data: kyc } = await admin
    .from("client_kyc")
    .select("file_path")
    .eq("consignor_id", id);
  const paths = ((kyc ?? []) as { file_path: string | null }[])
    .map((k) => k.file_path)
    .filter(Boolean) as string[];
  if (paths.length) await admin.storage.from("kyc-documents").remove(paths);

  const { error } = await admin.from("consignors").delete().eq("id", id);
  if (error) return { error: error.message };
  redirect("/clients");
}

export async function setKycStatus(
  id: string,
  consignorId: string,
  status: "pending" | "verified" | "rejected" | "expired",
) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_kyc")
    .update({
      status,
      verified_by: status === "verified" ? profile.id : null,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/clients/${consignorId}`);
  return { ok: true };
}

export async function deleteKyc(id: string, consignorId: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("client_kyc").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/clients/${consignorId}`);
  return { ok: true };
}
