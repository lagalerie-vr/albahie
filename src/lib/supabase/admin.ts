import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. SERVER ONLY. Never import this
 * into a Client Component. Used for privileged writes a manager is allowed to
 * make but the row-level policies (scoped to the acting user) would block,
 * e.g. registering another user as an auction participant.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
