"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { Radio, VideoOff } from "lucide-react";

type Status = "connecting" | "live" | "placeholder" | "error";

export function VideoPlayer({ auctionId }: { auctionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    let room: Room | null = null;
    let cancelled = false;

    (async () => {
      const res = await fetch(`/auctions/${auctionId}/viewer-token`);
      const data = await res.json();
      if (!data.configured || !data.url || !data.token) {
        setStatus("placeholder");
        return;
      }
      room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setStatus("live");
        }
      });
      await room.connect(data.url, data.token);
      if (cancelled) room.disconnect();
    })().catch(() => setStatus("error"));

    return () => {
      cancelled = true;
      room?.disconnect();
    };
  }, [auctionId]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={`h-full w-full object-contain ${status === "live" ? "" : "hidden"}`}
      />
      {status === "live" && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
          <Radio className="h-3 w-3" /> LIVE
        </span>
      )}
      {status !== "live" && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400">
          {status === "connecting" ? (
            <>
              <Radio className="h-8 w-8 animate-pulse" />
              <p className="text-sm">Connecting to live video…</p>
            </>
          ) : status === "placeholder" ? (
            <>
              <VideoOff className="h-8 w-8" />
              <p className="text-sm">Video not configured</p>
              <p className="text-xs">Set LiveKit env vars + start OBS (see README)</p>
            </>
          ) : (
            <>
              <VideoOff className="h-8 w-8" />
              <p className="text-sm">Stream offline</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
