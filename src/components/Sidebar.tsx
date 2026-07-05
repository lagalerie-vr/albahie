"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, type LucideIcon } from "lucide-react";
import { MODULES } from "@/lib/modules";

/**
 * Vertical module navigation shown on every page except the launchpad home.
 * Receives the module keys the current user may see (computed server-side)
 * and highlights the module that owns the current route.
 */
export function Sidebar({ allowedKeys }: { allowedKeys: string[] }) {
  const pathname = usePathname();
  const modules = MODULES.filter(
    (m) => m.status === "available" && allowedKeys.includes(m.key),
  );

  return (
    <aside className="hidden w-56 shrink-0 border-r border-neutral-200 md:block dark:border-neutral-800">
      <div className="sticky top-[58px] h-[calc(100vh-58px)] overflow-y-auto px-3 py-4">
        <nav className="flex flex-col gap-0.5" aria-label="Modules">
          <SidebarLink
            href="/launchpad"
            icon={Home}
            label="Home"
            active={pathname === "/launchpad"}
          />
          <div className="my-2 h-px bg-neutral-100 dark:bg-neutral-800" />
          {modules.map((m) => (
            <SidebarLink
              key={m.key}
              href={m.href}
              icon={m.icon}
              label={m.name}
              active={pathname === m.href || pathname.startsWith(`${m.href}/`)}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${
          active
            ? "text-brand-600 dark:text-brand-400"
            : "text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
