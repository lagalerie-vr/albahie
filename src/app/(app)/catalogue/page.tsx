import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Gavel, Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getHostAdapters } from "@live-auction/adapters";

const STATUS_ORDER: Record<string, number> = {
  live: 0,
  scheduled: 1,
  draft: 2,
  ended: 3,
};

export default async function CataloguePage() {
  const adapters = await getHostAdapters();
  const user = await adapters.getCurrentUser();
  if (!user) redirect("/login");
  try {
    await adapters.assertPermission(user.id, "auction.manage");
  } catch {
    redirect("/launchpad");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .schema("auction")
    .from("auctions")
    .select("id, title, status, starts_at, lots:lots(count), registrations:registrations(count)")
    .order("created_at", { ascending: false });

  const auctions = ((data ?? []) as unknown as {
    id: string;
    title: string;
    status: string;
    starts_at: string | null;
    lots: { count: number }[];
    registrations: { count: number }[];
  }[]).sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalogue &amp; Lots</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Build auctions from inventory, manage their lots and participants.
            Run them in Live Auction.
          </p>
        </div>
        <Link
          href="/catalogue/new"
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Plus className="h-4 w-4" />
          New auction
        </Link>
      </div>

      {auctions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No auctions yet.{" "}
          <Link href="/catalogue/new" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            Create one from inventory
          </Link>
          .
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {auctions.map((a) => (
            <Link
              key={a.id}
              href={`/catalogue/${a.id}`}
              className="flex items-center gap-4 bg-white px-5 py-4 transition hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.title}</span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="mt-0.5 flex items-center gap-3 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <Gavel className="h-3.5 w-3.5" />
                    {a.lots?.[0]?.count ?? 0} lots
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {a.registrations?.[0]?.count ?? 0} participants
                  </span>
                  {a.starts_at && <span>{new Date(a.starts_at).toLocaleString()}</span>}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    live: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    draft: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
    ended: "bg-neutral-100 text-neutral-400 dark:bg-neutral-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}
