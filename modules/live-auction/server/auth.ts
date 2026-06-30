// Validate a Supabase access token (sent by the browser) and resolve the
// auction roles + registration for the bidding server. The server is the
// authoritative decision-maker, so it independently verifies every connection.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { rolesForHostRole } from "../adapters/roles";
import type { AuctionRole } from "../adapters/types";

export interface AuthedUser {
  id: string;
  displayName: string;
  roles: AuctionRole[];
}

// Service role: the server is trusted and re-derives roles itself. The profile
// read must bypass RLS — the `profiles` select policy is `to authenticated`, and
// a token-only client queries PostgREST as `anon`, which would see no row and
// wrongly resolve every connection to a plain bidder.
let svc: SupabaseClient | null = null;
function svcClient(): SupabaseClient {
  if (!svc) {
    svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return svc;
}

export async function authenticate(token: string): Promise<AuthedUser | null> {
  const client = svcClient();
  // Validate the user's JWT (still the user's identity, not the service role).
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", data.user.id)
    .single();

  return {
    id: data.user.id,
    displayName: profile?.full_name || profile?.email || "User",
    roles: rolesForHostRole(profile?.role),
  };
}
