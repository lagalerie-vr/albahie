import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHostAdapters } from "@live-auction/adapters";
import { getVideoProvider, roomForAuction } from "@live-auction/video";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  const { auctionId } = await params;
  const adapters = await getHostAdapters();
  const user = await adapters.getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: auction } = await supabase
    .schema("auction")
    .from("auctions")
    .select("video_room")
    .eq("id", auctionId)
    .single();

  const room = roomForAuction(auctionId, auction?.video_room);
  const provider = await getVideoProvider();
  const token = await provider.getViewerToken(room, user.id, user.displayName);
  return NextResponse.json(token);
}
