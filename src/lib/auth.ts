import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/modules";
import {
  type Permissions,
  fullPerms,
  defaultStaffPerms,
  normalizePerms,
} from "@/lib/permissions";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  role_id: string | null;
  is_active: boolean;
}

/**
 * Returns the authenticated user's profile, or redirects to /login.
 * Use at the top of protected Server Components / layouts.
 *
 * Wrapped in React `cache()` so the layout + page in a single request share one
 * auth round-trip instead of each hitting Supabase.
 */
export const requireProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, role_id, is_active")
    .eq("id", user.id)
    .single();

  // No profile row (or deactivated) → treat as unauthorized.
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return profile as Profile;
});

/**
 * Like requireProfile, but also requires the admin role. Non-admins are sent
 * back to the launchpad. Use at the top of admin-only Server Components.
 */
export const requireAdmin = cache(async (): Promise<Profile> => {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/launchpad");
  return profile;
});

/**
 * Effective CRUD permissions for the current user. Admins get everything; a
 * user with a custom role gets that role's matrix; otherwise sensible staff
 * defaults (full access except Administration). Cached per request.
 */
export const getPermissions = cache(async (): Promise<Permissions> => {
  const profile = await requireProfile();
  if (profile.role === "admin") return fullPerms();
  if (profile.role_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_roles")
      .select("permissions")
      .eq("id", profile.role_id)
      .single();
    if (data) return normalizePerms(data.permissions);
  }
  return defaultStaffPerms();
});
