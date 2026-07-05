"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, CornerDownLeft, PackagePlus, CalendarPlus, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MODULES } from "@/lib/modules";

interface Command {
  key: string;
  name: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  group: "Modules" | "Actions";
}

/** Quick actions surfaced alongside module navigation. Keyed by the module
 *  whose permissions gate them. */
const ACTIONS: (Command & { moduleKey: string })[] = [
  {
    key: "action-receive",
    moduleKey: "consignments",
    name: "Receive item",
    hint: "New consignment intake",
    href: "/consignments/new",
    icon: PackagePlus,
    group: "Actions",
  },
  {
    key: "action-new-auction",
    moduleKey: "catalogue",
    name: "New auction",
    hint: "Create a sale and build its catalogue",
    href: "/catalogue/new",
    icon: CalendarPlus,
    group: "Actions",
  },
  {
    key: "action-new-client",
    moduleKey: "clients",
    name: "New client",
    hint: "Register a buyer or seller",
    href: "/clients",
    icon: UserPlus,
    group: "Actions",
  },
];

/**
 * Ctrl/Cmd+K launcher: jump to any module or common action. Opens on the
 * shortcut or on a window "open-command-palette" event (dispatched by the
 * header search button).
 */
export function CommandPalette({ allowedKeys }: { allowedKeys: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const mods: Command[] = MODULES.filter(
      (m) => m.status === "available" && allowedKeys.includes(m.key),
    ).map((m) => ({
      key: m.key,
      name: m.name,
      hint: m.description,
      href: m.href,
      icon: m.icon,
      group: "Modules" as const,
    }));
    const actions = ACTIONS.filter((a) => allowedKeys.includes(a.moduleKey));
    return [...actions, ...mods];
  }, [allowedKeys]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) {
            setQuery("");
            setActive(0);
          }
          return !v;
        });
      }
    }
    function onOpenEvent() {
      openPalette();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpenEvent);
    };
  }, [openPalette]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  // `open` can only become true after mount (keyboard/event), so the portal
  // never renders during SSR.
  if (!open) return null;

  const groups: Command["group"][] = ["Actions", "Modules"];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-950/40 p-4 pt-[15vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 dark:border-neutral-800">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === "Enter" && results[active]) {
                go(results[active].href);
              }
            }}
            placeholder="Jump to a module or action…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-neutral-400"
          />
          <kbd className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 dark:border-neutral-700">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-neutral-500">
              No matches for &ldquo;{query}&rdquo;
            </p>
          )}
          {groups.map((group) => {
            const items = results.filter((r) => r.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  {group}
                </p>
                {items.map((cmd) => {
                  const idx = results.indexOf(cmd);
                  const Icon = cmd.icon;
                  const isActive = idx === active;
                  return (
                    <button
                      key={cmd.key}
                      type="button"
                      onClick={() => go(cmd.href)}
                      onMouseMove={() => setActive(idx)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? "bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100"
                          : "text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isActive
                            ? "bg-brand-600 text-white dark:bg-brand-500"
                            : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {cmd.name}
                        </span>
                        <span className="block truncate text-xs text-neutral-400">
                          {cmd.hint}
                        </span>
                      </span>
                      {isActive && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Header button that opens the palette (keeps the two components decoupled). */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      className="hidden h-8 items-center gap-2 rounded-lg border border-neutral-200 px-2.5 text-xs text-neutral-400 transition hover:border-neutral-300 hover:text-neutral-600 sm:flex dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:text-neutral-300"
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search</span>
      <kbd className="rounded border border-neutral-200 px-1 text-[10px] font-medium dark:border-neutral-700">
        Ctrl K
      </kbd>
    </button>
  );
}
