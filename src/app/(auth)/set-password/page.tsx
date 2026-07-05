"use client";

import { useActionState } from "react";
import { setPassword, type AuthState } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-1 focus:ring-brand-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-brand-400 dark:focus:ring-brand-400";

export default function SetPasswordPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    setPassword,
    null,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Set your password</h2>
        <p className="text-sm text-neutral-500">
          Welcome aboard. Choose a password to finish setting up your account.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
          placeholder="At least 8 characters"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
          placeholder="Re-enter password"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <SubmitButton pendingText="Saving…">Save & continue</SubmitButton>
    </form>
  );
}
