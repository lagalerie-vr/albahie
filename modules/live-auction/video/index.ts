import type { VideoProvider } from "./types";
import { mockVideoProvider } from "./mock";

export * from "./types";

/** LiveKit when configured, otherwise the mock (placeholder) provider. */
export async function getVideoProvider(): Promise<VideoProvider> {
  const hasLiveKit =
    !!process.env.LIVEKIT_URL &&
    !!process.env.LIVEKIT_API_KEY &&
    !!process.env.LIVEKIT_API_SECRET;
  if (!hasLiveKit) return mockVideoProvider;
  const { createLiveKitProvider } = await import("./livekit");
  return createLiveKitProvider();
}

/** The LiveKit room name for an auction. */
export function roomForAuction(
  auctionId: string,
  configured?: string | null,
): string {
  return configured || `auction_${auctionId}`;
}
