import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHostAdapters } from "@live-auction/adapters";
import { getVideoProvider, roomForAuction } from "@live-auction/video";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  const { auctionId } = await params;
  const adapters = await getHostAdapters();
  const user = await adapters.getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await adapters.assertPermission(user.id, "auction.manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const force = new URL(_req.url).searchParams.get("force") === "1";

  const supabase = await createClient();
  const { data: auction } = await supabase
    .schema("auction")
    .from("auctions")
    .select("video_room, whip_url, whip_stream_key")
    .eq("id", auctionId)
    .single();

  const room = roomForAuction(auctionId, auction?.video_room);

  // Reuse the persisted ingress — we create it exactly once per auction so we
  // never accumulate ingress objects against the project cap.
  if (!force && auction?.whip_stream_key) {
    return NextResponse.json({
      whipUrl: auction.whip_url ?? "",
      streamKey: auction.whip_stream_key,
      room,
      configured: true,
    });
  }

  const hasEnv =
    !!process.env.LIVEKIT_URL &&
    !!process.env.LIVEKIT_API_KEY &&
    !!process.env.LIVEKIT_API_SECRET;
  if (!hasEnv) {
    return NextResponse.json({
      whipUrl: "",
      streamKey: "",
      room,
      configured: false,
      error:
        "LiveKit env vars are not loaded in this server process. Add LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET to .env.local and restart the dev server.",
    });
  }

  try {
    const provider = await getVideoProvider();
    const ingest = await provider.createIngest(room);
    // Persist so subsequent loads return these without touching LiveKit.
    await supabase
      .schema("auction")
      .from("auctions")
      .update({
        whip_url: ingest.whipUrl,
        whip_stream_key: ingest.streamKey,
        ingress_id: ingest.ingressId ?? null,
      })
      .eq("id", auctionId);
    return NextResponse.json(ingest);
  } catch (e) {
    return NextResponse.json({
      whipUrl: "",
      streamKey: "",
      room,
      configured: false,
      error: e instanceof Error ? e.message : "Could not create the WHIP ingress.",
    });
  }
}
