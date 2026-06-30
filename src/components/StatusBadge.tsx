import {
  STATUS_META,
  TONE_CLASSES,
  type ConsignmentStatus,
} from "@/lib/consignments";

export function StatusBadge({ status }: { status: ConsignmentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}
