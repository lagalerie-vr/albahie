import Link from "next/link";
import Image from "next/image";
import { requireProfile } from "@/lib/auth";
import { UserMenu } from "@/components/UserMenu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur print:hidden dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
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
          <UserMenu
            name={profile.full_name ?? ""}
            email={profile.email}
            role={profile.role}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
