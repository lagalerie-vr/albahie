"use client";

import { createClient } from "@/lib/supabase/client";

/** Browser Supabase client scoped to the `auction` schema. */
export function auctionDb() {
  return createClient().schema("auction");
}

/** Raw browser client (for auth token, host tables). */
export { createClient as hostBrowser } from "@/lib/supabase/client";
