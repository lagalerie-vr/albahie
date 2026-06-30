"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  UserPlus,
  Loader2,
  Check,
} from "lucide-react";
import {
  addParticipant,
  removeParticipant,
  deleteAuction,
} from "@/app/(app)/catalogue/[auctionId]/actions";
import { auctionDb, hostBrowser } from "../lib/client";
import {
  dollarsToCents,
  type Auction,
  type Lot,
  type Registration,
  type Client,
} from "../lib/types";
import { AUCTIONABLE_STATUSES } from "@/lib/consignments";

interface AvailableItem {
  id: string;
  reference: string;
  title: string;
  reserve_price: number | null;
  consignor: string | null;
}

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

type Tab = "details" | "lots" | "participants";

export function AuctionManager({
  auction: initial,
  clients,
}: {
  auction: Auction;
  clients: Client[];
}) {
  const [tab, setTab] = useState<Tab>("lots");
  const [auction, setAuction] = useState(initial);
  const [lots, setLots] = useState<Lot[]>([]);
  const [regs, setRegs] = useState<Registration[]>([]);

  const loadLots = useCallback(async () => {
    const { data } = await auctionDb()
      .from("lots")
      .select("*")
      .eq("auction_id", auction.id)
      .order("sort_order", { ascending: true });
    setLots((data as Lot[]) ?? []);
  }, [auction.id]);

  const loadRegs = useCallback(async () => {
    const { data } = await auctionDb()
      .from("registrations")
      .select("*")
      .eq("auction_id", auction.id)
      .order("paddle_no", { ascending: true });
    setRegs((data as Registration[]) ?? []);
  }, [auction.id]);

  useEffect(() => {
    loadLots();
    loadRegs();
  }, [loadLots, loadRegs]);

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        <TabButton active={tab === "lots"} onClick={() => setTab("lots")}>
          Lots ({lots.length})
        </TabButton>
        <TabButton active={tab === "participants"} onClick={() => setTab("participants")}>
          Participants ({regs.length})
        </TabButton>
        <TabButton active={tab === "details"} onClick={() => setTab("details")}>
          Details
        </TabButton>
      </div>

      {tab === "details" && (
        <DetailsTab auction={auction} onChange={setAuction} />
      )}
      {tab === "lots" && (
        <LotsTab auctionId={auction.id} lots={lots} reload={loadLots} />
      )}
      {tab === "participants" && (
        <ParticipantsTab
          auctionId={auction.id}
          regs={regs}
          clients={clients}
          reload={loadRegs}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
          : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

/* ----------------------------------- Details ----------------------------------- */

function DetailsTab({
  auction,
  onChange,
}: {
  auction: Auction;
  onChange: (a: Auction) => void;
}) {
  const [title, setTitle] = useState(auction.title);
  const [date, setDate] = useState(
    auction.starts_at ? auction.starts_at.slice(0, 16) : "",
  );
  const [softClose, setSoftClose] = useState(String(auction.soft_close_seconds));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  async function changeStatus(status: Auction["status"]) {
    setStatusBusy(true);
    await auctionDb().from("auctions").update({ status }).eq("id", auction.id);
    onChange({ ...auction, status });
    setStatusBusy(false);
  }

  async function save() {
    setSaving(true);
    const patch = {
      title: title.trim(),
      starts_at: date ? new Date(date).toISOString() : null,
      soft_close_seconds: Number(softClose) || 30,
    };
    await auctionDb().from("auctions").update(patch).eq("id", auction.id);
    onChange({ ...auction, ...patch });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function remove() {
    if (!confirm("Delete this auction and all its lots? This cannot be undone.")) return;
    await deleteAuction(auction.id);
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <label className="mb-1 block text-xs font-medium text-neutral-500">Status</label>
        <div className="mb-4 flex items-center gap-2">
          <select
            value={auction.status}
            disabled={statusBusy}
            onChange={(e) => changeStatus(e.target.value as Auction["status"])}
            className={`${input} max-w-[12rem]`}
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
          </select>
          <span className="text-xs text-neutral-400">
            Changes apply immediately.
          </span>
        </div>

        <label className="mb-1 block text-xs font-medium text-neutral-500">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />

        <label className="mb-1 mt-3 block text-xs font-medium text-neutral-500">Sale date</label>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={input}
        />

        <label className="mb-1 mt-3 block text-xs font-medium text-neutral-500">
          Soft-close (seconds)
        </label>
        <input
          type="number"
          value={softClose}
          onChange={(e) => setSoftClose(e.target.value)}
          className={input}
        />

        <button
          onClick={save}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5 dark:border-red-900/40 dark:bg-red-950/20">
        <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Deleting removes the auction, its lots, and registrations.
        </p>
        <button
          onClick={remove}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-4 w-4" /> Delete auction
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------ Lots ------------------------------------ */

function LotsTab({
  auctionId,
  lots,
  reload,
}: {
  auctionId: string;
  lots: Lot[];
  reload: () => void;
}) {
  const [available, setAvailable] = useState<AvailableItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const loadAvailable = useCallback(async () => {
    // All items already attached to any lot (exclude globally).
    const { data: lotRows } = await auctionDb().from("lots").select("source_ref");
    const used = new Set(
      ((lotRows as { source_ref: string | null }[]) ?? [])
        .map((r) => r.source_ref)
        .filter(Boolean) as string[],
    );
    const { data } = await hostBrowser()
      .from("consignment_items")
      .select(
        "id, reference, title, reserve_price, consignment:consignments ( consignor:consignors ( full_name ) )",
      )
      .in("status", AUCTIONABLE_STATUSES)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as {
      id: string;
      reference: string;
      title: string;
      reserve_price: number | null;
      consignment: { consignor: { full_name: string } | null } | null;
    }[];
    setAvailable(
      rows
        .filter((r) => !used.has(r.id))
        .map((r) => ({
          id: r.id,
          reference: r.reference,
          title: r.title,
          reserve_price: r.reserve_price,
          consignor: r.consignment?.consignor?.full_name ?? null,
        })),
    );
  }, []);

  useEffect(() => {
    if (picking) loadAvailable();
  }, [picking, loadAvailable]);

  async function addPicked() {
    if (picked.size === 0) return;
    setAdding(true);
    const items = available.filter((i) => picked.has(i.id));
    let nextNo = (lots.at(-1)?.lot_no ?? 0) + 1;
    let order = lots.length;
    const rows = items.map((it) => ({
      auction_id: auctionId,
      lot_no: nextNo++,
      title: it.title,
      reserve_cents: it.reserve_price != null ? Math.round(it.reserve_price * 100) : null,
      start_price_cents: 0,
      source_ref: it.id,
      sort_order: order++,
    }));
    await auctionDb().from("lots").insert(rows);
    setPicked(new Set());
    setPicking(false);
    setAdding(false);
    reload();
  }

  async function move(lot: Lot, dir: -1 | 1) {
    const idx = lots.findIndex((l) => l.id === lot.id);
    const swap = lots[idx + dir];
    if (!swap) return;
    await auctionDb().from("lots").update({ sort_order: swap.sort_order }).eq("id", lot.id);
    await auctionDb().from("lots").update({ sort_order: lot.sort_order }).eq("id", swap.id);
    reload();
  }

  async function removeLot(lot: Lot) {
    await auctionDb().from("lots").delete().eq("id", lot.id);
    reload();
  }

  async function savePrice(lot: Lot, field: "start_price_cents" | "reserve_cents", dollars: string) {
    const cents = dollarsToCents(dollars);
    await auctionDb().from("lots").update({ [field]: cents }).eq("id", lot.id);
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Lots
        </h2>
        <button
          onClick={() => setPicking((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          <Plus className="h-4 w-4" /> Add from inventory
        </button>
      </div>

      {picking && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          {available.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              No available inventory. In Inventory, set an item&apos;s status to Routed ·
              Auction or Cataloged to add it here.
            </p>
          ) : (
            <>
              <div className="max-h-72 divide-y divide-neutral-100 overflow-y-auto dark:divide-neutral-800">
                {available.map((it) => {
                  const checked = picked.has(it.id);
                  return (
                    <label key={it.id} className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(it.id)) next.delete(it.id);
                            else next.add(it.id);
                            return next;
                          })
                        }
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                      <span className="flex-1">
                        <span className="font-medium">{it.title}</span>
                        <span className="ml-2 font-mono text-xs text-neutral-400">{it.reference}</span>
                        <span className="block text-xs text-neutral-500">{it.consignor ?? "—"}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <button
                onClick={addPicked}
                disabled={adding || picked.size === 0}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add {picked.size} lot{picked.size === 1 ? "" : "s"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Lot</th>
              <th className="px-3 py-2">Start $</th>
              <th className="px-3 py-2">Reserve $</th>
              <th className="px-3 py-2 text-right">Order</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {lots.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 font-mono text-xs text-neutral-400">{l.lot_no}</td>
                <td className="px-3 py-2 font-medium">{l.title}</td>
                <td className="px-3 py-2">
                  <PriceCell cents={l.start_price_cents} onSave={(v) => savePrice(l, "start_price_cents", v)} />
                </td>
                <td className="px-3 py-2">
                  <PriceCell cents={l.reserve_cents} onSave={(v) => savePrice(l, "reserve_cents", v)} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => move(l, -1)} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button onClick={() => move(l, 1)} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => removeLot(l)} className="text-neutral-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {lots.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                  No lots yet. Add items from inventory.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceCell({
  cents,
  onSave,
}: {
  cents: number | null;
  onSave: (dollars: string) => void;
}) {
  const [value, setValue] = useState(cents != null ? String(Math.round(cents / 100)) : "");
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const current = cents != null ? String(Math.round(cents / 100)) : "";
        if (value !== current) onSave(value);
      }}
      placeholder="—"
      inputMode="decimal"
      className="w-24 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
    />
  );
}

/* -------------------------------- Participants -------------------------------- */

function ParticipantsTab({
  auctionId,
  regs,
  clients,
  reload,
}: {
  auctionId: string;
  regs: Registration[];
  clients: Client[];
  reload: () => void;
}) {
  const nameOf = (r: Registration) => {
    if (r.client_id) {
      const c = clients.find((x) => x.id === r.client_id);
      return c?.full_name || "Client";
    }
    return "Online bidder";
  };

  async function setStatus(reg: Registration, status: "approved" | "suspended") {
    await auctionDb().from("registrations").update({ status }).eq("id", reg.id);
    reload();
  }

  async function remove(reg: Registration) {
    await removeParticipant(auctionId, reg.id);
    reload();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2">Paddle</th>
                <th className="px-3 py-2">Participant</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {regs.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono">#{r.paddle_no}</td>
                  <td className="px-3 py-2">{nameOf(r)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2 text-xs font-medium">
                      {r.status !== "approved" && (
                        <button onClick={() => setStatus(r, "approved")} className="text-green-600 hover:underline">
                          Approve
                        </button>
                      )}
                      {r.status !== "suspended" && (
                        <button onClick={() => setStatus(r, "suspended")} className="text-amber-600 hover:underline">
                          Suspend
                        </button>
                      )}
                      <button onClick={() => remove(r)} className="text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {regs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                    No participants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddParticipant
        auctionId={auctionId}
        clients={clients}
        registeredClientIds={new Set(regs.map((r) => r.client_id).filter(Boolean) as string[])}
        reload={reload}
      />
    </div>
  );
}

function AddParticipant({
  auctionId,
  clients,
  registeredClientIds,
  reload,
}: {
  auctionId: string;
  clients: Client[];
  registeredClientIds: Set<string>;
  reload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "" });

  const q = query.trim().toLowerCase();
  const matches = q
    ? clients.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q),
      )
    : clients;

  async function addExisting(client: Client) {
    if (registeredClientIds.has(client.id)) return;
    setBusy(true);
    setError(null);
    const res = await addParticipant(auctionId, { clientId: client.id });
    setBusy(false);
    if (res?.error) return setError(res.error);
    setQuery("");
    reload();
  }

  async function createAndAdd() {
    setBusy(true);
    setError(null);
    const res = await addParticipant(auctionId, {
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone,
    });
    setBusy(false);
    if (res?.error) return setError(res.error);
    setNewClient({ name: "", email: "", phone: "" });
    setCreating(false);
    setQuery("");
    reload();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <UserPlus className="h-4 w-4" /> Add participant
      </h3>
      <p className="mb-3 text-xs text-neutral-500">
        Search your clients and register one with an approved paddle.
      </p>

      {!creating ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, phone…"
            className={input}
          />
          <div className="mt-2 max-h-56 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
            {matches.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-neutral-500">
                No matching client.
              </p>
            ) : (
              matches.slice(0, 50).map((c) => {
                const already = registeredClientIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => addExisting(c)}
                    disabled={already || busy}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50 disabled:opacity-50 dark:hover:bg-neutral-800/50"
                  >
                    <span>
                      <span className="font-medium">{c.full_name}</span>
                      <span className="block text-xs text-neutral-500">
                        {c.email || c.phone || "—"}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {already ? "Added" : "Add"}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            onClick={() => {
              setCreating(true);
              setNewClient((n) => ({ ...n, name: query }));
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" /> Client not listed — create new
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <input
            value={newClient.name}
            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            placeholder="Full name"
            className={input}
          />
          <input
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            placeholder="Email (optional)"
            className={input}
          />
          <input
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            placeholder="Phone (optional)"
            className={input}
          />
          <div className="flex gap-2">
            <button
              onClick={createAndAdd}
              disabled={busy || !newClient.name.trim()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create &amp; add
            </button>
            <button
              onClick={() => setCreating(false)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    suspended: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}
