// LiveKit VideoProvider. OBS -> WHIP ingress -> SFU -> WHEP/SDK viewers.
// Server-only (uses the API secret). Never import from client components.
import {
  AccessToken,
  IngressClient,
  IngressInput,
  type IngressInfo,
} from "livekit-server-sdk";
import type { IngestDetails, VideoProvider, ViewerToken } from "./types";

function httpUrl(wsUrl: string): string {
  return wsUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

export function createLiveKitProvider(): VideoProvider {
  const url = process.env.LIVEKIT_URL!;
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;

  return {
    async getViewerToken(room, identity, name): Promise<ViewerToken> {
      const at = new AccessToken(apiKey, apiSecret, { identity, name, ttl: "2h" });
      at.addGrant({
        roomJoin: true,
        room,
        canPublish: false, // viewers never publish
        canSubscribe: true,
      });
      return { url, token: await at.toJwt(), room, configured: true };
    },

    async createIngest(room): Promise<IngestDetails> {
      const client = new IngressClient(httpUrl(url), apiKey, apiSecret);

      // LiveKit Cloud caps the number of ingress objects per project. We keep
      // exactly one: reuse this room's WHIP ingress if it exists, and delete
      // every other ingress (stale rooms + duplicates) so we never hit the cap.
      // Phase 1 runs a single auction at a time, so pruning others is safe.
      const all = await client.listIngress({});
      const keep =
        all.find(
          (i) => i.roomName === room && i.inputType === IngressInput.WHIP_INPUT,
        ) ?? null;
      for (const i of all) {
        if (i.ingressId && i.ingressId !== keep?.ingressId) {
          try {
            await client.deleteIngress(i.ingressId);
          } catch {
            // best-effort prune; ignore individual delete failures
          }
        }
      }

      const info: IngressInfo =
        keep ??
        (await client.createIngress(IngressInput.WHIP_INPUT, {
          name: `obs-${room}`,
          roomName: room,
          participantIdentity: "obs",
          participantName: "OBS",
          enableTranscoding: true, // produce simulcast layers for weak viewers
        }));
      return {
        whipUrl: info.url ?? "",
        streamKey: info.streamKey ?? "",
        room,
        configured: true,
        ingressId: info.ingressId,
      };
    },
  };
}
