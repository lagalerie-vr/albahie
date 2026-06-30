"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import {
  inviteUser,
  setUserRole,
  setUserActive,
  setUserCustomRole,
} from "@/app/(app)/settings/actions";
import type { AppRole } from "@/components/admin/RolesAdmin";

export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string;
  role: "admin" | "staff";
  role_id: string | null;
  is_active: boolean;
  created_at: string;
}

const control =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function UsersAdmin({
  users,
  roles,
  currentUserId,
}: {
  users: AdminUser[];
  roles: AppRole[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function changeRole(u: AdminUser, role: "admin" | "staff") {
    setBusyId(u.id);
    setError(null);
    const res = await setUserRole(u.id, role);
    setBusyId(null);
    if (res?.error) setError(res.error);
    else router.refresh();
  }
  async function changeCustomRole(u: AdminUser, roleId: string) {
    setBusyId(u.id);
    setError(null);
    const res = await setUserCustomRole(u.id, roleId || null);
    setBusyId(null);
    if (res?.error) setError(res.error);
    else router.refresh();
  }
  async function toggleActive(u: AdminUser) {
    setBusyId(u.id);
    setError(null);
    const res = await setUserActive(u.id, !u.is_active);
    setBusyId(null);
    if (res?.error) setError(res.error);
    else router.refresh();
  }

  return (
    <div>
      <InviteForm
        onDone={(msg) => {
          setNotice(msg);
          setError(null);
          router.refresh();
        }}
        onError={(e) => {
          setError(e);
          setNotice(null);
        }}
      />

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {notice}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 font-medium">Permission role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
            {users.map((u) => {
              const self = u.id === currentUserId;
              return (
                <tr key={u.id} className={u.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3 font-medium">
                    {u.full_name || "—"} {self && <span className="text-xs text-neutral-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={self || busyId === u.id}
                      onChange={(e) => changeRole(u, e.target.value as "admin" | "staff")}
                      className={`${control} py-1`}
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "admin" ? (
                      <span className="text-xs text-neutral-400">Full access</span>
                    ) : (
                      <select
                        value={u.role_id ?? ""}
                        disabled={busyId === u.id}
                        onChange={(e) => changeCustomRole(u, e.target.value)}
                        className={`${control} py-1`}
                      >
                        <option value="">Staff defaults</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        u.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800"
                      }`}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={self || busyId === u.id}
                      className="text-xs font-medium text-neutral-600 hover:underline disabled:opacity-40 dark:text-neutral-300"
                    >
                      {busyId === u.id ? "…" : u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InviteForm({
  onDone,
  onError,
}: {
  onDone: (msg: string) => void;
  onError: (e: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await inviteUser(email, name, role);
    setBusy(false);
    if (res?.error) return onError(res.error);
    onDone(`Invitation sent to ${email}. They'll set a password via the email link.`);
    setEmail("");
    setName("");
    setRole("staff");
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-neutral-500">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="new.staff@albahie.com" className={`${control} w-full`} />
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-neutral-500">Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" className={`${control} w-full`} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "staff")} className={control}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Invite
      </button>
    </form>
  );
}
