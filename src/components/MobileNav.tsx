"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Menu, X, Home, type LucideIcon } from "lucide-react";
import { MODULES } from "@/lib/modules";

/**
 * Compact navigation for phones. A hamburger in the header opens a slide-in
 * drawer with the same module list the desktop sidebar shows. Hidden at md+
 * where the sidebar takes over.
 */
export function MobileNav({ allowedKeys }: { allowedKeys: string[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const modules = MODULES.filter(
    (m) => m.status === "available" && allowedKeys.includes(m.key),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 md:hidden dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-neutral-950/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col border-r border-neutral-200 bg-background shadow-xl dark:border-neutral-800">
              <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
                <Image
                  src="/logo.png"
                  alt="AlBahie Auction House"
                  width={120}
                  height={36}
                  className="h-6 w-auto dark:brightness-0 dark:invert"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3">
                <DrawerLink
                  href="/launchpad"
                  icon={Home}
                  label="Home"
                  active={pathname === "/launchpad"}
                  onNavigate={() => setOpen(false)}
                />
                <div className="my-2 h-px bg-neutral-100 dark:bg-neutral-800" />
                {modules.map((m) => (
                  <DrawerLink
                    key={m.key}
                    href={m.href}
                    icon={m.icon}
                    label={m.name}
                    active={pathname === m.href || pathname.startsWith(`${m.href}/`)}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </nav>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function DrawerLink({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200"
          : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${
          active ? "text-brand-600 dark:text-brand-400" : "text-neutral-400"
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
