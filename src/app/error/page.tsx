import Link from "next/link";

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  const message =
    reason === "invalid-link"
      ? "This link is invalid or has expired. Please ask an administrator to send you a new invite."
      : "Something went wrong. Please try again.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="mb-2 text-lg font-semibold">Authentication error</h1>
        <p className="mb-6 text-sm text-neutral-500">{message}</p>
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
