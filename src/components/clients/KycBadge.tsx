import type { ClientKycStanding } from "@/lib/clients";

const META: Record<ClientKycStanding, { label: string; cls: string }> = {
  verified: {
    label: "Verified",
    cls: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  pending: {
    label: "Pending",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  expired: {
    label: "Expired",
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  },
  none: {
    label: "No KYC",
    cls: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
  },
};

export function KycBadge({ standing }: { standing: ClientKycStanding }) {
  const m = META[standing];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${m.cls}`}>
      {m.label}
    </span>
  );
}
