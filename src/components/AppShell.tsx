"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

/**
 * Chooses the page frame based on the route:
 *   • Launchpad (home)  → full-width, no sidebar (the launchpad *is* the nav).
 *   • Every other page  → a left module sidebar with the content beside it.
 */
export function AppShell({
  allowedKeys,
  children,
}: {
  allowedKeys: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/launchpad";

  if (isHome) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1">
      <Sidebar allowedKeys={allowedKeys} />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 md:px-8">{children}</main>
    </div>
  );
}
