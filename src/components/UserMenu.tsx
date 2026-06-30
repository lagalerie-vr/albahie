"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { logout } from "@/app/(auth)/actions";

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = (name || email)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-medium text-white dark:bg-white dark:text-neutral-900">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block font-medium leading-tight">
            {name || email}
          </span>
          <span className="block text-xs capitalize leading-tight text-neutral-500">
            {role}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{name || email}</p>
            <p className="truncate text-xs text-neutral-500">{email}</p>
          </div>
          <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
