import { MODULES } from "@/lib/modules";

export type CrudKey = "c" | "r" | "u" | "d";
export interface ModulePerms {
  c: boolean;
  r: boolean;
  u: boolean;
  d: boolean;
}
export type Permissions = Record<string, ModulePerms>;

export const CRUD: { key: CrudKey; label: string }[] = [
  { key: "c", label: "Create" },
  { key: "r", label: "Read" },
  { key: "u", label: "Update" },
  { key: "d", label: "Delete" },
];

/** Modules that permissions can be granted on (mirrors the launchpad registry). */
export const PERMISSION_MODULES = MODULES.map((m) => ({ key: m.key, name: m.name }));

export function emptyPerms(): Permissions {
  const p: Permissions = {};
  for (const m of PERMISSION_MODULES) p[m.key] = { c: false, r: false, u: false, d: false };
  return p;
}

export function fullPerms(): Permissions {
  const p: Permissions = {};
  for (const m of PERMISSION_MODULES) p[m.key] = { c: true, r: true, u: true, d: true };
  return p;
}

/** Defaults for a staff user with no custom role: full access except Administration. */
export function defaultStaffPerms(): Permissions {
  const p = emptyPerms();
  for (const m of PERMISSION_MODULES) {
    if (m.key === "settings") continue;
    p[m.key] = { c: true, r: true, u: true, d: false };
  }
  return p;
}

export function can(perms: Permissions, moduleKey: string, action: CrudKey): boolean {
  return !!perms[moduleKey]?.[action];
}

/** Coerce a stored (possibly partial) permissions object onto a complete skeleton. */
export function normalizePerms(stored: unknown): Permissions {
  const base = emptyPerms();
  if (stored && typeof stored === "object") {
    for (const [k, v] of Object.entries(stored as Record<string, Partial<ModulePerms>>)) {
      if (base[k] && v && typeof v === "object") {
        base[k] = { c: !!v.c, r: !!v.r, u: !!v.u, d: !!v.d };
      }
    }
  }
  return base;
}
