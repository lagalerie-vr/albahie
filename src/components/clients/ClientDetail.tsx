"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, Plus, Trash2, ShieldCheck, Loader2, FileText, Upload } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { KycBadge } from "@/components/clients/KycBadge";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  updateClientRecord,
  addKyc,
  setKycStatus,
  deleteKyc,
  deleteClientRecord,
} from "@/app/(app)/clients/actions";
import {
  KYC_DOC_TYPES,
  docTypeLabel,
  kycStanding,
  type Client,
  type KycRecord,
} from "@/lib/clients";
import type { ConsignmentStatus } from "@/lib/consignments";

export interface SellerItem {
  id: string;
  reference: string;
  title: string;
  status: ConsignmentStatus;
  created_at: string;
}
export interface BuyerReg {
  id: string;
  paddle_no: number;
  status: string;
  auction_title: string;
}
export interface WonLot {
  id: string;
  lot_no: number;
  title: string;
  winning_amount_cents: number | null;
}

const control =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

function fmtCents(c: number | null): string {
  if (c == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(c / 100);
}

type Tab = "profile" | "kyc" | "activity";

export function ClientDetail({
  client,
  kyc,
  sellerItems,
  buyerRegs,
  wonLots,
  canDelete,
}: {
  client: Client;
  kyc: KycRecord[];
  sellerItems: SellerItem[];
  buyerRegs: BuyerReg[];
  wonLots: WonLot[];
  canDelete: boolean;
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const standing = kycStanding(kyc.map((k) => k.status));
  const isSeller = sellerItems.length > 0;
  const isBuyer = buyerRegs.length > 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{client.full_name}</h1>
        {isSeller && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            Seller
          </span>
        )}
        {isBuyer && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            Buyer
          </span>
        )}
        <KycBadge standing={standing} />
      </div>

      <div className="mb-5 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>Profile</TabButton>
        <TabButton active={tab === "kyc"} onClick={() => setTab("kyc")}>KYC ({kyc.length})</TabButton>
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>Activity</TabButton>
      </div>

      {tab === "profile" && <ProfileTab client={client} canDelete={canDelete} />}
      {tab === "kyc" && <KycTab consignorId={client.id} records={kyc} />}
      {tab === "activity" && (
        <ActivityTab sellerItems={sellerItems} buyerRegs={buyerRegs} wonLots={wonLots} />
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

function ProfileTab({ client, canDelete }: { client: Client; canDelete: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: client.full_name,
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    notes: client.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    await updateClientRecord(client.id, form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete ${client.full_name}? This cannot be undone.`)) return;
    setDeleting(true);
    setDelErr(null);
    const res = await deleteClientRecord(client.id);
    setDeleting(false);
    if (res?.error) setDelErr(res.error);
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <Field label="Full name">
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={control} />
        </Field>
        <Field label="Email">
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={control} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={control} />
        </Field>
        <Field label="Address">
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={control} />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={control} />
        </Field>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
      </div>

      {canDelete && (
        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5 dark:border-red-900/40 dark:bg-red-950/20">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Permanently delete this client and their KYC records. Clients with consignment
            history can&apos;t be deleted.
          </p>
          {delErr && (
            <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              {delErr}
            </p>
          )}
          <button
            onClick={remove}
            disabled={deleting}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete client
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-500">{label}</label>
      {children}
    </div>
  );
}

function KycTab({ consignorId, records }: { consignorId: string; records: KycRecord[] }) {
  const router = useRouter();
  const [docType, setDocType] = useState<string>(KYC_DOC_TYPES[0].value);
  const [form, setForm] = useState({ doc_number: "", doc_country: "", expires_at: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setErr(null);
    let file_path: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${consignorId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createBrowserClient()
        .storage.from("kyc-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setBusy(false);
        setErr(`Upload failed: ${error.message}`);
        return;
      }
      file_path = path;
    }
    await addKyc(consignorId, { doc_type: docType, ...form, file_path });
    setForm({ doc_number: "", doc_country: "", expires_at: "", notes: "" });
    setFile(null);
    setBusy(false);
    router.refresh();
  }

  async function viewDoc(path: string) {
    const { data } = await createBrowserClient()
      .storage.from("kyc-documents")
      .createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function setStatus(id: string, status: "verified" | "rejected" | "expired" | "pending") {
    await setKycStatus(id, consignorId, status);
    router.refresh();
  }
  async function remove(id: string) {
    if (!confirm("Delete this KYC record?")) return;
    await deleteKyc(id, consignorId);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
            No KYC records yet. Add an identity document on the right.
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((k) => (
              <div key={k.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {docTypeLabel(k.doc_type)}
                      {k.doc_number && <span className="ml-2 font-mono text-xs text-neutral-500">{k.doc_number}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {k.doc_country || "—"}
                      {k.expires_at && ` · expires ${new Date(k.expires_at).toLocaleDateString()}`}
                      {k.verified_at && ` · verified ${new Date(k.verified_at).toLocaleDateString()}`}
                    </p>
                    {k.notes && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{k.notes}</p>}
                  </div>
                  <KycBadge standing={k.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                  {k.file_path && (
                    <button onClick={() => viewDoc(k.file_path!)} className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
                      <FileText className="h-3.5 w-3.5" /> View document
                    </button>
                  )}
                  {k.status !== "verified" && (
                    <button onClick={() => setStatus(k.id, "verified")} className="inline-flex items-center gap-1 text-green-600 hover:underline">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verify
                    </button>
                  )}
                  {k.status !== "rejected" && (
                    <button onClick={() => setStatus(k.id, "rejected")} className="text-red-600 hover:underline">Reject</button>
                  )}
                  {k.status !== "expired" && (
                    <button onClick={() => setStatus(k.id, "expired")} className="text-orange-600 hover:underline">Mark expired</button>
                  )}
                  {k.status !== "pending" && (
                    <button onClick={() => setStatus(k.id, "pending")} className="text-neutral-500 hover:underline">Reset</button>
                  )}
                  <button onClick={() => remove(k.id)} className="ml-auto inline-flex items-center gap-1 text-neutral-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="mb-3 text-sm font-semibold">Add document</h3>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Document type</label>
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className={`${control} mb-2`}>
          {KYC_DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <input placeholder="Document number" value={form.doc_number} onChange={(e) => setForm({ ...form, doc_number: e.target.value })} className={`${control} mb-2`} />
        <input placeholder="Country" value={form.doc_country} onChange={(e) => setForm({ ...form, doc_country: e.target.value })} className={`${control} mb-2`} />
        <label className="mb-1 block text-xs font-medium text-neutral-500">Expires</label>
        <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className={`${control} mb-2`} />
        <textarea placeholder="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${control} mb-2`} />

        <label className="mb-1 block text-xs font-medium text-neutral-500">Document scan / image</label>
        <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
          <Upload className="h-4 w-4" />
          <span className="truncate">{file ? file.name : "Choose image or PDF…"}</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {err && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {err}
          </p>
        )}
        <button
          onClick={add}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add record
        </button>
      </div>
    </div>
  );
}

function ActivityTab({
  sellerItems,
  buyerRegs,
  wonLots,
}: {
  sellerItems: SellerItem[];
  buyerRegs: BuyerReg[];
  wonLots: WonLot[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Section title={`Consigned items (${sellerItems.length})`}>
        {sellerItems.length === 0 ? (
          <Empty>Nothing consigned yet.</Empty>
        ) : (
          sellerItems.map((it) => (
            <div key={it.id} className="flex items-center gap-3 border-b border-neutral-100 py-2.5 text-sm last:border-0 dark:border-neutral-800">
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{it.reference}</span>
              <span className="flex-1">{it.title}</span>
              <StatusBadge status={it.status} />
            </div>
          ))
        )}
      </Section>

      <Section title="Paddles & bidding">
        {buyerRegs.length === 0 ? (
          <Empty>Not registered for any auction.</Empty>
        ) : (
          buyerRegs.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-neutral-100 py-2.5 text-sm last:border-0 dark:border-neutral-800">
              <span className="font-mono text-xs text-neutral-500">#{r.paddle_no}</span>
              <span className="flex-1">{r.auction_title}</span>
              <span className="text-xs text-neutral-400">{r.status}</span>
            </div>
          ))
        )}
        {wonLots.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Lots won ({wonLots.length})
            </p>
            {wonLots.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-b border-neutral-100 py-2 text-sm last:border-0 dark:border-neutral-800">
                <span className="font-mono text-xs text-neutral-500">Lot {l.lot_no}</span>
                <span className="flex-1">{l.title}</span>
                <span className="font-medium tabular-nums">{fmtCents(l.winning_amount_cents)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-neutral-500">{children}</p>;
}
