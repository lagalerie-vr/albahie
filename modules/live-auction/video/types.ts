// Pluggable live video. Default impl = LiveKit. Swap by implementing this
// interface and returning it from video/index.ts.

export interface IngestDetails {
  /** WHIP endpoint OBS publishes to. */
  whipUrl: string;
  /** Bearer token OBS sends with the WHIP request. */
  streamKey: string;
  room: string;
  /** Empty when using the mock provider (no real ingest configured). */
  configured: boolean;
  /** Provider's ingress object id, if any (used to persist/reuse it). */
  ingressId?: string;
}

export interface ViewerToken {
  /** WebRTC signalling URL (wss://…) the browser connects to. */
  url: string;
  /** Short-lived subscribe-only access token. */
  token: string;
  room: string;
  /** Empty when using the mock provider (UI shows a placeholder). */
  configured: boolean;
}

export interface VideoProvider {
  /** Create/return an OBS ingest for a room (auctioneer/admin only). */
  createIngest(room: string): Promise<IngestDetails>;
  /** Mint a subscribe-only viewer token for a room. */
  getViewerToken(room: string, identity: string, name?: string): Promise<ViewerToken>;
}
