import {
  Gavel,
  Percent,
  Receipt,
  CheckCircle2,
  CircleDollarSign,
  TrendingUp,
  Tag,
  Boxes,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { STATUS_META, type ConsignmentStatus } from "@/lib/consignments";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ExportCsv } from "@/components/reports/ExportCsv";

const money = (c: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format((c || 0) / 100);
const dollars = (c: number) => Math.round((c || 0) / 100);

const TONE_BAR: Record<string, string> = {
  amber: "bg-amber-400",
  blue: "bg-blue-400",
  green: "bg-green-500",
  red: "bg-red-400",
  neutral: "bg-neutral-400",
};

interface InvoiceLite {
  status: string;
  auction_id: string | null;
  hammer_cents: number;
  premium_cents: number;
  total_cents: number;
  buyer_name: string | null;
  client_id: string | null;
  created_at: string;
}
interface LotLite {
  id: string;
  auction_id: string;
  title: string;
  status: string;
  winning_amount_cents: number | null;
  current_price_cents: number | null;
  source_ref: string | null;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; auction?: string }>;
}) {
  await requireProfile();
  const sp = await searchParams;
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const auctionId = sp.auction ?? "";
  const supabase = await createClient();

  const [{ data: inv }, { data: auctions }, { data: lots }, { data: items }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("status, auction_id, hammer_cents, premium_cents, total_cents, buyer_name, client_id, created_at"),
      supabase.schema("auction").from("auctions").select("id, title").order("created_at", { ascending: false }),
      supabase
        .schema("auction")
        .from("lots")
        .select("id, auction_id, title, status, winning_amount_cents, current_price_cents, source_ref"),
      supabase.from("consignment_items").select("id, status, category"),
    ]);

  const auctionList = ((auctions ?? []) as { id: string; title: string }[]);
  const titleOf = new Map(auctionList.map((a) => [a.id, a.title]));

  // Filters
  const fromMs = from ? new Date(from + "T00:00:00").getTime() : null;
  const toMs = to ? new Date(to + "T23:59:59").getTime() : null;
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  };

  const invoices = ((inv ?? []) as InvoiceLite[]).filter(
    (i) => inRange(i.created_at) && (!auctionId || i.auction_id === auctionId),
  );
  const lotList = ((lots ?? []) as LotLite[]).filter(
    (l) => !auctionId || l.auction_id === auctionId,
  );
  const itemList = ((items ?? []) as { id: string; status: ConsignmentStatus; category: string | null }[]);
  const categoryOf = new Map(itemList.map((it) => [it.id, it.category]));

  // Revenue
  const hammerTotal = invoices.reduce((s, i) => s + i.hammer_cents, 0);
  const premiumTotal = invoices.reduce((s, i) => s + i.premium_cents, 0);
  const invoicedTotal = invoices.reduce((s, i) => s + i.total_cents, 0);
  const settledTotal = invoices.filter((i) => i.status === "settled").reduce((s, i) => s + i.total_cents, 0);
  const outstandingTotal = invoicedTotal - settledTotal;
  const avgLot = invoices.length ? Math.round(hammerTotal / invoices.length) : 0;
  const premiumRate = hammerTotal ? Math.round((premiumTotal / hammerTotal) * 100) : 0;

  // Sell-through (auction filter only — not date-bound)
  const lotHammer = (l: LotLite) => l.winning_amount_cents ?? l.current_price_cents ?? 0;
  const soldLots = lotList.filter((l) => l.status === "sold");
  const closed = lotList.filter((l) => l.status === "sold" || l.status === "passed");
  const sellThrough = closed.length ? Math.round((soldLots.length / closed.length) * 100) : 0;

  // Per-auction performance
  const perAuction = new Map<string, { auction: string; lots: number; sold: number; hammer: number }>();
  for (const l of lotList) {
    const row = perAuction.get(l.auction_id) ?? {
      auction: titleOf.get(l.auction_id) ?? "—",
      lots: 0,
      sold: 0,
      hammer: 0,
    };
    row.lots += 1;
    if (l.status === "sold") {
      row.sold += 1;
      row.hammer += lotHammer(l);
    }
    perAuction.set(l.auction_id, row);
  }
  const auctionRows = [...perAuction.values()]
    .sort((a, b) => b.hammer - a.hammer)
    .map((r) => ({ ...r, sell_through: r.lots ? Math.round((r.sold / r.lots) * 100) : 0 }));

  // Top lots
  const topLots = [...soldLots]
    .sort((a, b) => lotHammer(b) - lotHammer(a))
    .slice(0, 10)
    .map((l) => ({
      lot: l.title,
      auction: titleOf.get(l.auction_id) ?? "",
      hammer: dollars(lotHammer(l)),
    }));

  // Top buyers
  const buyers = new Map<string, { buyer: string; lots: number; total: number }>();
  for (const i of invoices) {
    const key = i.client_id ?? i.buyer_name ?? "unknown";
    const row = buyers.get(key) ?? { buyer: i.buyer_name ?? "—", lots: 0, total: 0 };
    row.lots += 1;
    row.total += i.total_cents;
    buyers.set(key, row);
  }
  const topBuyers = [...buyers.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((b) => ({ ...b, total: dollars(b.total) }));

  // Sales by category (sold lots → host item category)
  const byCategory = new Map<string, number>();
  for (const l of soldLots) {
    const cat = (l.source_ref && categoryOf.get(l.source_ref)) || "Uncategorised";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + lotHammer(l));
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...categoryRows.map(([, v]) => v));

  // Invoiced by month (last 6)
  const months: { key: string; label: string; total: number }[] = [];
  const now = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: "short" }), total: 0 });
  }
  const mIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const i of invoices) {
    const d = new Date(i.created_at);
    const idx = mIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx != null) months[idx].total += i.total_cents;
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  // Inventory by status (not affected by filters — current snapshot)
  const statusCounts = new Map<ConsignmentStatus, number>();
  for (const it of itemList) statusCounts.set(it.status, (statusCounts.get(it.status) ?? 0) + 1);
  const statusRows = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statusRows.map(([, n]) => n));

  // CSV: raw invoices
  const invoiceCsv = invoices.map((i) => ({
    date: new Date(i.created_at).toLocaleDateString(),
    buyer: i.buyer_name ?? "",
    auction: (i.auction_id && titleOf.get(i.auction_id)) || "",
    hammer: dollars(i.hammer_cents),
    premium: dollars(i.premium_cents),
    total: dollars(i.total_cents),
    status: i.status,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sale performance, revenue, and operational analytics.
          </p>
        </div>
        <ExportCsv
          filename="invoices.csv"
          label="Export invoices"
          columns={[
            { key: "date", label: "Date" },
            { key: "buyer", label: "Buyer" },
            { key: "auction", label: "Auction" },
            { key: "hammer", label: "Hammer ($)" },
            { key: "premium", label: "Premium ($)" },
            { key: "total", label: "Total ($)" },
            { key: "status", label: "Status" },
          ]}
          rows={invoiceCsv}
        />
      </div>

      <ReportFilters auctions={auctionList} initial={{ from, to, auction: auctionId }} />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-8">
        <Kpi icon={Gavel} label="Hammer total" value={money(hammerTotal)} />
        <Kpi icon={Percent} label={`Premium (${premiumRate}%)`} value={money(premiumTotal)} />
        <Kpi icon={Receipt} label="Total invoiced" value={money(invoicedTotal)} />
        <Kpi icon={CheckCircle2} label="Settled" value={money(settledTotal)} />
        <Kpi icon={CircleDollarSign} label="Outstanding" value={money(outstandingTotal)} />
        <Kpi icon={TrendingUp} label="Sell-through" value={`${sellThrough}%`} />
        <Kpi icon={Tag} label="Avg lot" value={money(avgLot)} />
        <Kpi icon={Boxes} label="Lots sold" value={String(soldLots.length)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Invoiced by month">
          {invoicedTotal === 0 ? (
            <Empty>No invoices in range.</Empty>
          ) : (
            <div className="flex h-44 items-end gap-2 pt-2 sm:gap-3">
              {months.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-neutral-900 dark:bg-white"
                      style={{ height: `${Math.max(2, (m.total / maxMonth) * 100)}%` }}
                      title={money(m.total)}
                    />
                  </div>
                  <span className="text-[10px] text-neutral-500">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Sales by category">
          {categoryRows.length === 0 ? (
            <Empty>No sales in range.</Empty>
          ) : (
            <div className="space-y-2">
              {categoryRows.map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 truncate text-neutral-600 dark:text-neutral-300 sm:w-40">{cat}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${(val / maxCat) * 100}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums text-neutral-500">{money(val)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Sale performance */}
      <Panel
        title="Sale performance"
        className="mb-6"
        action={
          <ExportCsv
            filename="sale-performance.csv"
            columns={[
              { key: "auction", label: "Auction" },
              { key: "lots", label: "Lots" },
              { key: "sold", label: "Sold" },
              { key: "sell_through", label: "Sell-through %" },
              { key: "hammer", label: "Hammer (cents)" },
            ]}
            rows={auctionRows}
          />
        }
      >
        {auctionRows.length === 0 ? (
          <Empty>No auctions match.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Auction</th>
                  <th className="px-4 py-2.5 text-right font-medium">Lots</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sold</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sell-through</th>
                  <th className="px-4 py-2.5 text-right font-medium">Hammer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {auctionRows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-medium">{r.auction}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.lots}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.sold}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.sell_through}%</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(r.hammer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title="Top lots by hammer"
          action={
            <ExportCsv
              filename="top-lots.csv"
              columns={[
                { key: "lot", label: "Lot" },
                { key: "auction", label: "Auction" },
                { key: "hammer", label: "Hammer ($)" },
              ]}
              rows={topLots}
            />
          }
        >
          {topLots.length === 0 ? (
            <Empty>No lots sold.</Empty>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {topLots.map((l, i) => (
                <div key={i} className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex-1 truncate">{l.lot}</span>
                  <span className="hidden truncate text-xs text-neutral-400 sm:block">{l.auction}</span>
                  <span className="font-medium tabular-nums">${l.hammer.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Top buyers"
          action={
            <ExportCsv
              filename="top-buyers.csv"
              columns={[
                { key: "buyer", label: "Buyer" },
                { key: "lots", label: "Lots" },
                { key: "total", label: "Total ($)" },
              ]}
              rows={topBuyers}
            />
          }
        >
          {topBuyers.length === 0 ? (
            <Empty>No buyers in range.</Empty>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {topBuyers.map((b, i) => (
                <div key={i} className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex-1 truncate">{b.buyer}</span>
                  <span className="text-xs text-neutral-400">{b.lots} lot{b.lots === 1 ? "" : "s"}</span>
                  <span className="font-medium tabular-nums">${b.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Inventory by status" className="mt-6">
        {statusRows.length === 0 ? (
          <Empty>No items in inventory.</Empty>
        ) : (
          <div className="space-y-2">
            {statusRows.map(([s, n]) => (
              <div key={s} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate text-neutral-600 dark:text-neutral-300 sm:w-44">{STATUS_META[s].label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div className={`h-full rounded-full ${TONE_BAR[STATUS_META[s].tone]}`} style={{ width: `${(n / maxStatus) * 100}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums text-neutral-500">{n}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Gavel; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] text-neutral-500">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-neutral-400" />
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums sm:text-xl">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
  action,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-neutral-500">{children}</p>;
}
