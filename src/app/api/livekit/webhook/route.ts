import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * LiveKit webhook — flips an auction's status when its OBS ingress starts/stops.
 *   ingress_started  → status "live"
 *   ingress_ended    → status "ended"
 *
 * Configure in the LiveKit dashboard (Project → Webhooks) pointing at
 * `<your-public-url>/api/livekit/webhook`. Requires a public URL, so for local
 * testing use a tunnel (cloudflared / ngrok) — the Start/Stop buttons in the
 * control panel do the same thing manually.
 */
export async function POST(req: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "livekit not configured" }, { status: 400 });
  }

  const body = await req.text();
  const auth = req.headers.get("Authorization") ?? "";

  let event;
  try {
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    event = await receiver.receive(body, auth);
  } catch {
    return NextResponse.json({ error: "invalid webhook signature" }, { status: 400 });
  }

  if (event.event === "ingress_started" || event.event === "ingress_ended") {
    const room = event.ingressInfo?.roomName ?? event.room?.name ?? "";
    const ingressId = event.ingressInfo?.ingressId ?? null;
    const auctionId = room.startsWith("auction_") ? room.slice("auction_".length) : null;
    const status = event.event === "ingress_started" ? "live" : "ended";

    const admin = createAdminClient();
    if (auctionId) {
      await admin.schema("auction").from("auctions").update({ status }).eq("id", auctionId);
    } else if (ingressId) {
      await admin.schema("auction").from("auctions").update({ status }).eq("ingress_id", ingressId);
    }
  }

  return NextResponse.json({ received: true });
}
