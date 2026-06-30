"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, Pencil, Shield, Check, X } from "lucide-react";
import {
  CRUD,
  PERMISSION_MODULES,
  emptyPerms,
  normalizePerms,
  type CrudKey,
  type Permissions,
} from "@/lib/permissions";
import { createRole, updateRole, deleteRole } from "@/app/(app)/settings/actions";

export interface AppRole {
  id: string;
  name: string;
  permissions: Permissions;
}

export function RolesAdmin({ roles }: { roles: AppRole[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AppRole | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(r: AppRole) {
    if (!confirm(`Delete the role "${r.name}"? Users with it revert to staff defaults.`)) return;
    const res = await deleteRole(r.id);
    if (res?.error) setError(res.error);
    else router.refresh();
  }

  if (editing) {
    return (
      <RoleEditor
        role={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mb-3">
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          <Plus className="h-4 w-4" /> New role
        </button>
      </div>

      {roles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No custom roles yet. Create one to grant fine-grained module access.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roles.map((r) => {
            const granted = PERMISSION_MODULES.filter((m) =>
              (["c", "r", "u", "d"] as CrudKey[]).some((k) => r.permissions[m.key]?.[k]),
            ).length;
            return (
              <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="flex items-center gap-1.5 font-medium">
                      <Shield className="h-4 w-4 text-neutral-400" /> {r.name}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Access to {granted} module{granted === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs font-medium">
                    <button onClick={() => setEditing(r)} className="inline-flex items-center gap-1 text-neutral-600 hover:underline dark:text-neutral-300">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button onClick={() => remove(r)} className="inline-flex items-center gap-1 text-red-600 hover:underline">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoleEditor({
  role,
  onClose,
  onSaved,
}: {
  role: AppRole | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [perms, setPerms] = useState<Permissions>(
    role ? normalizePerms(role.permissions) : emptyPerms(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(moduleKey: string, k: CrudKey) {
    setPerms((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [k]: !prev[moduleKey][k] },
    }));
  }
  function toggleRow(moduleKey: string, value: boolean) {
    setPerms((prev) => ({
      ...prev,
      [moduleKey]: { c: value, r: value, u: value, d: value },
    }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = role
      ? await updateRole(role.id, name, perms)
      : await createRole(name, perms);
    setBusy(false);
    if (res?.error) return setError(res.error);
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">{role ? "Edit role" : "New role"}</h3>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <label className="mb-1 block text-xs font-medium text-neutral-500">Role name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Front desk, Cataloguer, Finance"
        className="mb-4 w-full max-w-sm rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2 font-medium">Module</th>
              {CRUD.map((c) => (
                <th key={c.key} className="px-3 py-2 text-center font-medium">{c.label}</th>
              ))}
              <th className="px-3 py-2 text-center font-medium">All</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {PERMISSION_MODULES.map((m) => {
              const row = perms[m.key];
              const allOn = row.c && row.r && row.u && row.d;
              return (
                <tr key={m.key}>
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  {CRUD.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row[c.key]}
                        onChange={() => toggle(m.key, c.key)}
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleRow(m.key, !allOn)}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {allOn ? "Clear" : "All"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {role ? "Save role" : "Create role"}
        </button>
        <button onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
          Cancel
        </button>
      </div>
    </div>
  );
}
