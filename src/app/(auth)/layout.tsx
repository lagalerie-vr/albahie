import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
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
          <p className="text-sm text-neutral-500">Enterprise Resource Planning</p>
        </div>
        {children}
      </div>
    </main>
  );
}
