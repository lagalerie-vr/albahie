// Mock VideoProvider — no real SFU. The bidder UI shows a placeholder pane and
// everything else (bidding, console, audit) works. Used when LiveKit env vars
// are absent.
import type { VideoProvider } from "./types";

export const mockVideoProvider: VideoProvider = {
  async getViewerToken(room) {
    return { url: "", token: "", room, configured: false };
  },
  async createIngest(room) {
    return {
      whipUrl: "(set LIVEKIT_URL/API keys to enable WHIP ingest)",
      streamKey: "",
      room,
      configured: false,
    };
  },
};
