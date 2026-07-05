import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      {/* Brand hairline */}
      <div
        aria-hidden
        className="h-0.5 bg-gradient-to-r from-brand-700 via-gold-400 to-brand-700"
      />
      {/* Soft teal wash behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-50 to-transparent dark:from-brand-950/40"
      />

      <div className="relative flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Image
              src="/logo.png"
              alt="AlBahie Auction House"
              width={220}
              height={67}
              priority
              className="mx-auto mb-3 h-12 w-auto dark:brightness-0 dark:invert"
            />
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
              A Division of Abu Issa Group
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Consignment &amp; Auction Management
            </p>
          </div>
          {children}
        </div>
      </div>

      <p className="relative pb-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
        © {new Date().getFullYear()} AlBahie Auction House · Staff access only
      </p>
    </main>
  );
}
