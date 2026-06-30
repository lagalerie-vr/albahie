"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** An image thumbnail that expands to full screen when clicked. */
export function LightboxImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        className={`cursor-zoom-in ${className ?? ""}`}
      />
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setOpen(false)}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
