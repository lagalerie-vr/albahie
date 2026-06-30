import { Users, ShoppingBag, Tag, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { kycStanding, type ClientRow } from "@/lib/clients";
import { ClientsTable } from "@/components/clients/ClientsTable";

export default async function ClientsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: clients }, { data: consignments }, { data: regs }, { data: kyc }] =
    await Promise.all([
      supabase
        .from("consignors")
        .select("id, full_name, email, phone, address, notes, created_at")
        .order("full_name", { ascending: true }),
      supabase.from("consignments").select("consignor_id"),
      supabase.schema("auction").from("registrations").select("client_id"),
      supabase.from("client_kyc").select("consignor_id, status"),
    ]);

  const salesByClient = new Map<string, number>();
  for (const c of (consignments ?? []) as { consignor_id: string }[]) {
    salesByClient.set(c.consignor_id, (salesByClient.get(c.consignor_id) ?? 0) + 1);
  }
  const buysByClient = new Map<string, number>();
  for (const r of (regs ?? []) as { client_id: string | null }[]) {
    if (r.client_id) buysByClient.set(r.client_id, (buysByClient.get(r.client_id) ?? 0) + 1);
  }
  const kycByClient = new Map<string, string[]>();
  for (const k of (kyc ?? []) as { consignor_id: string; status: string }[]) {
    const arr = kycByClient.get(k.consignor_id) ?? [];
    arr.push(k.status);
    kycByClient.set(k.consignor_id, arr);
  }

  const rows: ClientRow[] = (
    (clients ?? []) as Omit<ClientRow, "sales_count" | "buyer_count" | "kyc">[]
  ).map((c) => ({
    ...c,
    sales_count: salesByClient.get(c.id) ?? 0,
    buyer_count: buysByClient.get(c.id) ?? 0,
    kyc: kycStanding(kycByClient.get(c.id) ?? []),
  }));

  const buyers = rows.filter((r) => r.buyer_count > 0).length;
  const sellers = rows.filter((r) => r.sales_count > 0).length;
  const verified = rows.filter((r) => r.kyc === "verified").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Buyers, sellers, paddles, and KYC records.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Users} label="Total clients" value={rows.length} />
        <Kpi icon={ShoppingBag} label="Buyers" value={buyers} />
        <Kpi icon={Tag} label="Sellers" value={sellers} />
        <Kpi icon={ShieldCheck} label="KYC verified" value={verified} />
      </div>

      <ClientsTable rows={rows} />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{label}</span>
        <Icon className="h-4 w-4 text-neutral-400" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
