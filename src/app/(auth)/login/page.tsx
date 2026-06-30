"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { login, type AuthState } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white dark:focus:ring-white";

function LoginForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(login, null);
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") ?? "";

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <input type="hidden" name="redirectedFrom" value={redirectedFrom} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
          placeholder="you@auctionhouse.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
          placeholder="••••••••"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>

      <p className="text-center text-xs text-neutral-500">
        Accounts are created by an administrator. Contact your admin if you need
        access.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
