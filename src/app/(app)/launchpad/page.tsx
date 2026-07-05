import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Scale,
  Boxes,
  Receipt,
  Gavel,
  Activity,
  AlertTriangle,
  Inbox,
  Pencil,
  MapPin,
  Check,
  X,
  CalendarPlus,
  Circle,
  ChevronRight,
} from "lucide-react";
import { requireProfile, getPermissions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MODULES, type AppModule } from "@/lib/modules";
import { can } from "@/lib/permissions";
import { fmtCents } from "@/lib/invoices";

/** Statuses that mean the house is physically holding the property. */
const IN_CUSTODY = [
  "awaiting_appraisal",
  "extended_review",
  "accepted",
  "routed_auction",
  "routed_private",
  "cataloged",
  "in_auction",
  "after_sale",
];

const SECTIONS: { title: string; keys: string[] }[] = [
  { title: "Pipeline", keys: ["consignments", "appraisal", "inventory"] },
  { title: "Sales", keys: ["catalogue", "auctions", "invoicing"] },
  { title: "Clients & insight", keys: ["clients", "reports", "logistics"] },
  { title: "Administration", keys: ["settings"] },
];

export default async function LaunchpadPage() {
  const profile = await requireProfile();
  const perms = await getPermissions();
  const supabase = await createClient();

  const modules = MODULES.filter(
    (m) => (!m.roles || m.roles.includes(profile.role)) && can(perms, m.key, "r"),
  );
  const allowed = new Set(modules.map((m) => m.key));
  const firstName = (profile.full_name ?? profile.email).split(" ")[0];

  // Live pulse of the house, gathered in one round of parallel queries.
  const [itemsRes, invoicesRes, nextAuctionRes, activityRes] = await Promise.all([
    supabase
      .from("consignment_items")
      .select("id, reference, title, status, appraisal_due_at"),
    supabase.from("invoices").select("status, total_cents"),
    supabase
      .schema("auction")
      .from("auctions")
      .select("id, title, status, starts_at")
      .in("status", ["live", "scheduled"])
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(1),
    supabase
      .from("item_activity")
      .select(
        `id, kind, summary, created_at,
         item:consignment_items ( id, reference, title ),
         actor_profile:profiles!item_activity_actor_fkey ( full_name, email )`,
      )
      .order("created_at", { ascending: false })
      .limit(7),
  ]);

  type ItemRow = {
    id: string;
    reference: string | null;
    title: string | null;
    status: string;
    appraisal_due_at: string | null;
  };
  const items = (itemsRes.data ?? []) as ItemRow[];
  const now = new Date().getTime();
  const awaiting = items.filter(
    (i) => i.status === "awaiting_appraisal" || i.status === "extended_review",
  );
  const overdue = awaiting.filter(
    (i) => i.appraisal_due_at && new Date(i.appraisal_due_at).getTime() < now,
  ).length;
  const inCustody = items.filter((i) => IN_CUSTODY.includes(i.status)).length;

  // "Needs attention" — awaiting items already overdue or due within 3 days,
  // soonest first. This is the "no item sits silently" principle, surfaced.
  const soonMs = 3 * 24 * 60 * 60 * 1000;
  const needsAttention = awaiting
    .filter((i) => i.appraisal_due_at && new Date(i.appraisal_due_at).getTime() - now < soonMs)
    .sort(
      (a, b) =>
        new Date(a.appraisal_due_at!).getTime() -
        new Date(b.appraisal_due_at!).getTime(),
    )
    .slice(0, 6);

  type ActivityRow = {
    id: string;
    kind: string;
    summary: string;
    created_at: string;
    item: { id: string; reference: string | null; title: string | null } | null;
    actor_profile: { full_name: string | null; email: string } | null;
  };
  const activity = (activityRes.data ?? []) as unknown as ActivityRow[];

  const invoices = invoicesRes.data ?? [];
  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const unpaidTotal = unpaid.reduce((s, i) => s + (i.total_cents ?? 0), 0);

  const nextAuction = nextAuctionRes.data?.[0] ?? null;
  const auctionValue = nextAuction
    ? nextAuction.status === "live"
      ? "Live now"
      : nextAuction.starts_at
        ? new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
          }).format(new Date(nextAuction.starts_at))
        : "Scheduled"
    : "—";

  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">
          {today}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Here is the state of the house today.
        </p>
      </div>

      {/* Pulse */}
      <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {allowed.has("appraisal") && (
          <Pulse
            href="/appraisal"
            icon={Scale}
            label="Awaiting appraisal"
            value={String(awaiting.length)}
            sub={overdue > 0 ? `${overdue} overdue` : "None overdue"}
            alert={overdue > 0}
          />
        )}
        {allowed.has("inventory") && (
          <Pulse
            href="/inventory"
            icon={Boxes}
            label="Items in custody"
            value={String(inCustody)}
            sub="Across all locations"
          />
        )}
        {allowed.has("auctions") && (
          <Pulse
            href="/auctions"
            icon={Gavel}
            label="Next auction"
            value={auctionValue}
            sub={nextAuction?.title ?? "Nothing scheduled"}
            live={nextAuction?.status === "live"}
          />
        )}
        {allowed.has("invoicing") && (
          <Pulse
            href="/invoicing"
            icon={Receipt}
            label="Unpaid invoices"
            value={String(unpaid.length)}
            sub={unpaid.length > 0 ? `${fmtCents(unpaidTotal)} outstanding` : "All settled"}
            alert={unpaid.length > 0}
          />
        )}
      </div>

      {/* Operations panel — the live pulse of the floor */}
      {(allowed.has("inventory") || allowed.has("appraisal")) && (
        <div className="mb-10 grid gap-4 lg:grid-cols-5">
          {allowed.has("inventory") && (
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Activity className="h-4 w-4 text-brand-500" />
                  Recent activity
                </h2>
                <Link
                  href="/inventory"
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  All items
                </Link>
              </div>
              {activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-500">
                  Activity across the house will appear here as items move.
                </p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={a.item ? `/inventory/items/${a.item.id}` : "/inventory"}
                        className="group flex items-start gap-3 rounded-lg -mx-2 px-2 py-1.5 transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                      >
                        <span className="mt-0.5">{activityIcon(a.kind)}</span>
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-medium">{a.summary}</span>
                          {a.item && (
                            <span className="text-neutral-500">
                              {" "}· {a.item.reference}
                              {a.item.title ? ` — ${a.item.title}` : ""}
                            </span>
                          )}
                          <span className="block text-xs text-neutral-400">
                            {relativeTime(a.created_at)}
                            {a.actor_profile
                              ? ` · ${a.actor_profile.full_name || a.actor_profile.email}`
                              : ""}
                          </span>
                        </span>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {allowed.has("appraisal") && (
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-2 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Needs attention
                </h2>
                <Link
                  href="/appraisal"
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  Queue
                </Link>
              </div>
              {needsAttention.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <Check className="mb-2 h-6 w-6 text-green-500" />
                  <p className="text-sm text-neutral-500">
                    Nothing overdue or due soon. The floor is clear.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {needsAttention.map((i) => {
                    const due = new Date(i.appraisal_due_at!).getTime();
                    const isOverdue = due < now;
                    return (
                      <li key={i.id}>
                        <Link
                          href={`/consignments/items/${i.id}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2 text-sm transition hover:border-brand-300 dark:border-neutral-800 dark:hover:border-brand-700"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {i.title || i.reference || "Item"}
                            </span>
                            <span className="block text-xs text-neutral-400">
                              {i.reference}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              isOverdue
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {isOverdue ? "Overdue" : dueLabel(due, now)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {/* Modules */}
      <div className="space-y-8">
        {SECTIONS.map((section) => {
          const sectionModules = section.keys
            .map((k) => modules.find((m) => m.key === k))
            .filter((m): m is AppModule => !!m);
          if (sectionModules.length === 0) return null;
          return (
            <section key={section.title}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sectionModules.map((mod) => (
                  <ModuleCard key={mod.key} mod={mod} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Small coloured icon for an activity kind (mirrors the ItemHistory legend). */
function activityIcon(kind: string) {
  const cls = "h-4 w-4";
  switch (kind) {
    case "received":
      return <Inbox className={`${cls} text-blue-600 dark:text-blue-400`} />;
    case "updated":
      return <Pencil className={`${cls} text-neutral-500`} />;
    case "location":
      return <MapPin className={`${cls} text-purple-600 dark:text-purple-400`} />;
    case "accepted":
      return <Check className={`${cls} text-green-600 dark:text-green-400`} />;
    case "rejected":
      return <X className={`${cls} text-red-600 dark:text-red-400`} />;
    case "extended":
      return <CalendarPlus className={`${cls} text-amber-600 dark:text-amber-400`} />;
    default:
      return <Circle className={`${cls} text-neutral-400`} />;
  }
}

/** "3h ago", "2d ago" — compact relative time for the activity feed. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Due today" / "2d left" for an upcoming (not yet overdue) deadline. */
function dueLabel(dueMs: number, nowMs: number): string {
  const days = Math.ceil((dueMs - nowMs) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Due today";
  if (days === 1) return "1d left";
  return `${days}d left`;
}

function Pulse({
  href,
  icon: Icon,
  label,
  value,
  sub,
  alert = false,
  live = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
  live?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-brand-700"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{label}</span>
        <Icon className="h-4 w-4 text-brand-500 dark:text-brand-400" />
      </div>
      <p className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        {value}
        {live && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-950 dark:text-red-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            Live
          </span>
        )}
      </p>
      <p
        className={`mt-1 truncate text-xs ${
          alert
            ? "font-medium text-amber-600 dark:text-amber-400"
            : "text-neutral-400 dark:text-neutral-500"
        }`}
      >
        {sub}
      </p>
    </Link>
  );
}

function ModuleCard({ mod }: { mod: AppModule }) {
  const Icon = mod.icon;
  const available = mod.status === "available";

  const card = (
    <div
      className={`group relative h-full rounded-2xl border p-5 transition ${
        available
          ? "cursor-pointer border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-brand-700"
          : "border-dashed border-neutral-200 bg-white/50 dark:border-neutral-800 dark:bg-neutral-900/50"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            available
              ? "bg-brand-700 text-white dark:bg-brand-500"
              : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        {available ? (
          <ArrowUpRight className="h-4 w-4 text-neutral-300 opacity-0 transition group-hover:text-brand-500 group-hover:opacity-100" />
        ) : (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:bg-neutral-800">
            Soon
          </span>
        )}
      </div>
      <h3 className="text-base font-semibold">{mod.name}</h3>
      <p className="mt-1 text-sm text-neutral-500">{mod.description}</p>
    </div>
  );

  return available ? (
    <Link href={mod.href}>{card}</Link>
  ) : (
    <div aria-disabled>{card}</div>
  );
}
