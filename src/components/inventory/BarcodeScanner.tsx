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
 * Camera QR/barcode scanner. Uses the native BarcodeDetector API where it
 * exists (Chrome/Edge/Android — reads QR *and* 1-D barcodes), and falls back
 * to jsQR for QR codes everywhere else (notably iOS Safari, which has no
 * BarcodeDetector). A manual entry field is always available.
 *
 * Note: camera access requires a secure context (https or localhost). Opening
 * the app over a plain-http LAN address will block the camera in every browser;
 * the manual field still works in that case.
 */
export function BarcodeScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    function cleanup() {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          "The camera needs a secure (https) connection. Open the app over https, or type the reference below.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setError(
          "Couldn’t access the camera. Allow camera access in your browser, or type the reference below.",
        );
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

      // Prefer the native detector (QR + 1-D barcodes); else jsQR (QR only).
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;
      let detector: BarcodeDetectorLike | null = null;
      if (Ctor) {
        try {
          detector = new Ctor();
        } catch {
          detector = null;
        }
      }
      // Lazily load jsQR only when the native detector is unavailable, so a
      // problem loading it can never stop the scanner dialog from opening.
      let jsQR: typeof import("jsqr").default | null = null;
      if (!detector) {
        try {
          jsQR = (await import("jsqr")).default;
        } catch {
          jsQR = null;
        }
      }
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (stopped || !videoRef.current) return;
        const v = videoRef.current;
        let value: string | undefined;
        try {
          if (detector) {
            const codes = await detector.detect(v);
            value = codes.find((c) => c.rawValue)?.rawValue;
          } else if (jsQR && ctx && v.videoWidth) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height, {
              inversionAttempts: "dontInvert",
            });
            value = found?.data || undefined;
          }
        } catch {
          // transient decode errors between frames are expected
        }
        if (value) {
          if (onScan(value)) {
            stopped = true;
            cleanup();
            return;
          }
          setNotFound(value);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
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
          {!error ? (
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/70" />
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!error && (
            <p className="mt-3 text-center text-xs text-neutral-500">
              Point the camera at the item’s QR code.
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
                className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400"
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
