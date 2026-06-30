import Link from "next/link";
import { redirect } from "next/navigation";
import { Radio, Eye, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getHostAdapters } from "@live-auction/adapters";

const STATUS_ORDER: Record<string, number> = {
  live: 0,
  scheduled: 1,
  draft: 2,
  ended: 3,
};

export default async function AuctionsPage() {
  const adapters = await getHostAdapters();
  const user = await adapters.getCurrentUser();
  if (!user) redirect("/login");

  const canManage = user.roles.includes("manage");

  const supabase = await createClient();
  const { data } = await supabase
    .schema("auction")
    .from("auctions")
    .select("id, title, status, starts_at, lots:lots(count)")
    .order("created_at", { ascending: false });

  const auctions = ((data ?? []) as unknown as {
    id: string;
    title: string;
    status: string;
    starts_at: string | null;
    lots: { count: number }[];
  }[]).sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Live Auction</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Control panel for running sales — connect OBS, start the stream, and
          run the room. Auctions are built in{" "}
          <Link href="/catalogue" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            Catalogue &amp; Lots
          </Link>
          .
        </p>
      </div>

      {auctions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No auctions yet. Build one in{" "}
          <Link href="/catalogue/new" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            Catalogue &amp; Lots
          </Link>
          .
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {auctions.map((a) => {
            const isLive = a.status === "live";
            const lotCount = a.lots?.[0]?.count ?? 0;
            return (
              <div
                key={a.id}
                className="flex items-center gap-4 bg-white px-5 py-4 dark:bg-neutral-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        isLive
                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                          : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                      }`}
                    >
                      {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
                      {a.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {lotCount} lot{lotCount === 1 ? "" : "s"}
                    {a.starts_at ? ` · ${new Date(a.starts_at).toLocaleString()}` : ""}
                  </p>
                </div>

                <Link
                  href={`/auctions/${a.id}/live`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  <Eye className="h-4 w-4" /> Watch
                </Link>
                {canManage && (
                  <Link
                    href={`/auctions/${a.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
                  >
                    <Radio className="h-4 w-4" /> Control panel
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
