import Link from "next/link";
import Image from "next/image";
import { requireProfile, getPermissions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppShell } from "@/components/AppShell";
import { MobileNav } from "@/components/MobileNav";
import {
  CommandPalette,
  CommandPaletteTrigger,
} from "@/components/CommandPalette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const perms = await getPermissions();
  const allowedKeys = MODULES.filter(
    (m) =>
      (!m.roles || m.roles.includes(profile.role)) && can(perms, m.key, "r"),
  ).map((m) => m.key);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Brand hairline */}
      <div
        aria-hidden
        className="h-0.5 bg-gradient-to-r from-brand-700 via-gold-400 to-brand-700 print:hidden"
      />

      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur print:hidden dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-1.5">
            <MobileNav allowedKeys={allowedKeys} />
            <Link href="/launchpad" className="flex items-center" aria-label="AlBahie Auction House">
              <Image
                src="/logo.png"
                alt="AlBahie Auction House"
                width={132}
                height={40}
                priority
                className="h-7 w-auto dark:brightness-0 dark:invert"
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <CommandPaletteTrigger />
            <ThemeToggle />
            <UserMenu
              name={profile.full_name ?? ""}
              email={profile.email}
              role={profile.role}
            />
          </div>
        </div>
      </header>

      <CommandPalette allowedKeys={allowedKeys} />

      <AppShell allowedKeys={allowedKeys}>{children}</AppShell>
    </div>
  );
}
