"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizePerms, type Permissions } from "@/lib/permissions";

type Role = "admin" | "staff";

export async function inviteUser(email: string, fullName: string, role: Role) {
  await requireAdmin();
  const e = email.trim();
  if (!e) return { error: "Email is required." };

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(e, {
    data: { full_name: fullName.trim() || null, role },
    redirectTo: `${siteUrl}/auth/confirm`,
  });
  if (error) return { error: error.message };
  if (role === "admin" && data.user) {
    await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function setUserRole(userId: string, role: Role) {
  const me = await requireAdmin();
  if (userId === me.id) return { error: "You can’t change your own role." };
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function setUserActive(userId: string, isActive: boolean) {
  const me = await requireAdmin();
  if (userId === me.id) return { error: "You can’t deactivate your own account." };
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_active: isActive }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function createSaleEvent(name: string, saleDate: string, location: string) {
  await requireAdmin();
  if (!name.trim()) return { error: "Name is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("auctions").insert({
    name: name.trim(),
    sale_date: saleDate || null,
    location: location.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function setSaleEventStatus(id: string, status: "upcoming" | "closed") {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("auctions").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

// ── Custom roles ────────────────────────────────────────────────────────────

export async function createRole(name: string, permissions: Permissions) {
  await requireAdmin();
  if (!name.trim()) return { error: "Role name is required." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_roles")
    .insert({ name: name.trim(), permissions: normalizePerms(permissions) });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateRole(id: string, name: string, permissions: Permissions) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_roles")
    .update({ name: name.trim(), permissions: normalizePerms(permissions) })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteRole(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  // Detach the role from any users first.
  await admin.from("profiles").update({ role_id: null }).eq("role_id", id);
  const { error } = await admin.from("app_roles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function setUserCustomRole(userId: string, roleId: string | null) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role_id: roleId })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
