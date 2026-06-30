"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ScanLine, Keyboard, AlertTriangle } from "lucide-react";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/**
 * Camera QR/barcode scanner using the native BarcodeDetector API (Chrome/Edge).
 * `onScan` returns true when the code matched an item (the scanner then closes);
 * false keeps the camera running so the user can try another label. A manual
 * entry field is always available as a fallback.
 */
export function BarcodeScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;
      if (!Ctor) {
        setSupported(false);
        return;
      }
      let detector: BarcodeDetectorLike;
      try {
        detector = new Ctor();
      } catch {
        setSupported(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setError("Couldn’t access the camera. Check permissions, or type the reference below.");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const tick = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes.find((c) => c.rawValue)?.rawValue;
          if (value) {
            const ok = onScan(value);
            if (ok) {
              stopped = true;
              cleanup();
              return;
            }
            setNotFound(value);
          }
        } catch {
          // transient detect errors between frames are expected
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    }

    start();
    return () => {
      stopped = true;
      cleanup();
    };
  }, [onScan]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manual.trim();
    if (!code) return;
    if (!onScan(code)) setNotFound(code);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="flex items-center gap-2 font-semibold">
            <ScanLine className="h-5 w-5" /> Scan item code
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {supported && !error ? (
            <div className="relative overflow-hidden rounded-xl bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/70" />
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error ??
                  "This browser can’t scan with the camera. Use Chrome or Edge, or type the reference below."}
              </span>
            </div>
          )}

          {supported && !error && (
            <p className="mt-3 text-center text-xs text-neutral-500">
              Point the camera at the item’s QR code or barcode.
            </p>
          )}

          {notFound && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              No inventory item matches <span className="font-mono">{notFound}</span>.
            </p>
          )}

          <form onSubmit={submitManual} className="mt-4">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <Keyboard className="h-3.5 w-3.5" /> Or enter the reference
            </label>
            <div className="flex gap-2">
              <input
                value={manual}
                onChange={(e) => {
                  setManual(e.target.value);
                  setNotFound(null);
                }}
                placeholder="e.g. CN-2026-00001-01"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                autoComplete="off"
              />
              <button
                type="submit"
                className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
              >
                Find
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
