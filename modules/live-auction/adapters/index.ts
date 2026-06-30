// Resolve which host adapters the Next side uses. Default = real host;
// set AUCTION_ADAPTERS=mock to run the module fully isolated.
import type { HostAdapters } from "./types";
import { mockAdapters } from "./mock";

export * from "./types";
export { rolesForHostRole, permitted } from "./roles";

export async function getHostAdapters(): Promise<HostAdapters> {
  if (process.env.AUCTION_ADAPTERS === "mock") return mockAdapters;
  // Lazy import so the mock path never pulls in host internals / next/headers.
  const { supabaseHostAdapters } = await import("./supabase-host");
  return supabaseHostAdapters;
}
