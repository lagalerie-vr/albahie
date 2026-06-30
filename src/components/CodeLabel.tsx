"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a scannable QR code + Code128 barcode for an item reference.
 * QR encodes a deep link to the item; the barcode encodes the raw reference.
 */
export function CodeLabel({
  value,
  url,
  size = 128,
}: {
  value: string;
  url?: string;
  size?: number;
}) {
  const [qr, setQr] = useState<string>("");
  const barcodeRef = useRef<SVGSVGElement>(null);

  // Heavy libs are imported lazily so they stay out of the initial bundle.
  useEffect(() => {
    let cancelled = false;
    import("qrcode").then((m) =>
      m.default
        .toDataURL(url ?? value, { margin: 1, width: size })
        .then((d) => !cancelled && setQr(d))
        .catch(() => !cancelled && setQr("")),
    );
    return () => {
      cancelled = true;
    };
  }, [value, url, size]);

  useEffect(() => {
    let cancelled = false;
    import("jsbarcode").then((m) => {
      if (cancelled || !barcodeRef.current) return;
      try {
        m.default(barcodeRef.current, value, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          height: 44,
          width: 1.6,
        });
      } catch {
        // invalid barcode value — ignore
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-2">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt={`QR code for ${value}`}
          width={size}
          height={size}
          className="rounded"
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="animate-pulse rounded bg-neutral-100 dark:bg-neutral-800"
        />
      )}
      <svg ref={barcodeRef} className="w-full max-w-[180px]" />
      <span className="font-mono text-xs tracking-wide text-neutral-600 dark:text-neutral-400">
        {value}
      </span>
    </div>
  );
}
