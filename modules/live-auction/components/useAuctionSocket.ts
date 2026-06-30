"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  ClientMessage,
  ConnectedUser,
  ControlAction,
  LotSnapshot,
  ServerMessage,
} from "../server/protocol";
import type { BidChannel } from "../engine/types";

export interface BidResult {
  idempotencyKey: string;
  accepted: boolean;
  reason?: string;
}

/**
 * Where the bidding WebSocket lives. In the combined single-host deployment it's
 * the same origin at /auction-ws; for split hosting set NEXT_PUBLIC_AUCTION_WS_URL
 * to the bidding server's wss:// URL (used in local dev → ws://localhost:4001).
 */
function resolveAuctionWsUrl(): string {
  const env = process.env.NEXT_PUBLIC_AUCTION_WS_URL;
  if (env) return env;
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/auction-ws`;
}

export function useAuctionSocket(lotId: string | null) {
  const [snapshot, setSnapshot] = useState<LotSnapshot | null>(null);
  const [user, setUser] = useState<ConnectedUser | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastResult, setLastResult] = useState<BidResult | null>(null);
  const [lastError, setLastError] = useState<{ message: string; at: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!lotId) return;
    let closed = false;
    let socket: WebSocket | null = null;

    (async () => {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token ?? "";
      const url = resolveAuctionWsUrl();
      if (!url) return;

      socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        socket?.send(JSON.stringify({ t: "hello", token, lotId } satisfies ClientMessage));
      };
      socket.onclose = () => !closed && setConnected(false);
      socket.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as ServerMessage;
        if (msg.t === "welcome") {
          setUser(msg.user);
          setSnapshot(msg.lot);
        } else if (msg.t === "state") {
          setSnapshot(msg.lot);
        } else if (msg.t === "bid.result") {
          setLastResult({
            idempotencyKey: msg.idempotencyKey,
            accepted: msg.accepted,
            reason: msg.reason,
          });
        } else if (msg.t === "error") {
          setLastError({ message: msg.message, at: Date.now() });
        }
      };
    })();

    return () => {
      closed = true;
      socket?.close();
      wsRef.current = null;
    };
  }, [lotId]);

  const placeBid = useCallback(
    (amountCents?: number): string | undefined => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== ws.OPEN || !lotId) return;
      const idempotencyKey = crypto.randomUUID();
      ws.send(JSON.stringify({ t: "bid", lotId, idempotencyKey, amountCents } satisfies ClientMessage));
      return idempotencyKey;
    },
    [lotId],
  );

  const control = useCallback(
    (
      action: ControlAction,
      extra?: { paddleNo?: number; amountCents?: number; channel?: BidChannel },
    ) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== ws.OPEN || !lotId) return;
      ws.send(JSON.stringify({ t: "ctrl", lotId, action, ...extra } satisfies ClientMessage));
    },
    [lotId],
  );

  return { snapshot, user, connected, lastResult, lastError, placeBid, control };
}
