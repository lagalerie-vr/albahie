import {
  Inbox,
  Pencil,
  MapPin,
  Check,
  X,
  CalendarPlus,
  Circle,
} from "lucide-react";

export interface ActivityEntry {
  id: string;
  kind: string;
  summary: string;
  detail: string | null;
  created_at: string;
  actor_profile: { full_name: string | null; email: string } | null;
}

/**
 * The full lifecycle log of an item — every recorded change from intake
 * onward, newest first. Pure component, usable in server or client.
 */
export function ItemHistory({ entries }: { entries: ActivityEntry[] }) {
  if (!entries || entries.length === 0) {
    return <p className="text-sm text-neutral-500">No activity recorded.</p>;
  }

  const sorted = [...entries].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );

  return (
    <ol className="space-y-4">
      {sorted.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className="mt-0.5">{kindIcon(e.kind)}</span>
          <div className="text-sm">
            <p className="font-medium">
              {e.summary}
              <span className="ml-2 text-xs font-normal text-neutral-400">
                {formatDateTime(e.created_at)}
              </span>
            </p>
            {e.detail && (
              <p className="text-neutral-600 dark:text-neutral-400">{e.detail}</p>
            )}
            <p className="text-xs text-neutral-500">
              {e.actor_profile?.full_name || e.actor_profile?.email || "—"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function kindIcon(kind: string) {
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
