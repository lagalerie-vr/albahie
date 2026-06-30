// Real host adapters for THIS platform (AlBahie ERP): Supabase Auth + profiles.
// This is the ONLY module file allowed to import host internals.
import { createClient } from "@/lib/supabase/server";
import type { HostAdapters } from "./types";
import { PermissionError } from "./types";
import { rolesForHostRole, permitted } from "./roles";
import { recordChargeWith, emitPlatformEventWith } from "./platform";

export const supabaseHostAdapters: HostAdapters = {
  async getCurrentUser() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", user.id)
      .single();

    return {
      id: user.id,
      displayName: profile?.full_name || profile?.email || "User",
      roles: rolesForHostRole(profile?.role),
    };
  },

  async assertPermission(userId, action) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (!permitted(rolesForHostRole(data?.role), action)) {
      throw new PermissionError(action);
    }
  },

  async recordCharge(userId, lotId, amountCents) {
    const supabase = await createClient();
    await recordChargeWith(supabase, userId, lotId, amountCents);
  },

  async emitPlatformEvent(event) {
    const supabase = await createClient();
    await emitPlatformEventWith(supabase, event);
  },
};
