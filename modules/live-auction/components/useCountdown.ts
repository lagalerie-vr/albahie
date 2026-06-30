"use client";

import { useEffect, useState } from "react";

/** Seconds remaining until `endsAt` (epoch ms), ticking each 250ms. */
export function useCountdown(endsAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  if (endsAt == null) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
