export const APPRAISAL_WINDOW_DAYS = 14;

export type ConsignmentStatus =
  | "awaiting_appraisal"
  | "extended_review"
  | "declined"
  | "accepted"
  | "routed_auction"
  | "routed_private"
  | "cataloged"
  | "in_auction"
  | "sold"
  | "after_sale"
  | "sold_privately"
  | "returned"
  | "withdrawn";

/** Statuses for items that can be added to an auction (and aren't sold/returned). */
export const AUCTIONABLE_STATUSES: ConsignmentStatus[] = [
  "accepted",
  "routed_auction",
  "cataloged",
  "in_auction",
];

export const STATUS_META: Record<
  ConsignmentStatus,
  { label: string; tone: "amber" | "blue" | "green" | "red" | "neutral" }
> = {
  awaiting_appraisal: { label: "Awaiting Appraisal", tone: "amber" },
  extended_review: { label: "Extended Review", tone: "amber" },
  declined: { label: "Declined", tone: "red" },
  accepted: { label: "Accepted", tone: "green" },
  routed_auction: { label: "Routed · Auction", tone: "blue" },
  routed_private: { label: "Routed · Private Sale", tone: "blue" },
  cataloged: { label: "Cataloged", tone: "blue" },
  in_auction: { label: "In Auction", tone: "blue" },
  sold: { label: "Sold", tone: "green" },
  after_sale: { label: "After-Sale Window", tone: "amber" },
  sold_privately: { label: "Sold Privately", tone: "green" },
  returned: { label: "Returned", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const TONE_CLASSES: Record<
  "amber" | "blue" | "green" | "red" | "neutral",
  string
> = {
  amber:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-400/20",
  green:
    "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950 dark:text-green-300 dark:ring-green-400/20",
  red: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300 dark:ring-red-400/20",
  neutral:
    "bg-neutral-100 text-neutral-600 ring-neutral-500/20 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-400/20",
};

/** Common physical locations an item can occupy. */
export const LOCATIONS = [
  "Receiving Counter",
  "Holding Tray",
  "Photography Studio",
  "Storage A",
  "Storage B",
  "Storage C",
  "Strong Room",
  "Saleroom",
  "Shipping Bay",
  "Returned to Consignor",
] as const;

/** Auction categories an item can be assigned to at intake. */
export const CATEGORIES = [
  "Fine Art",
  "Furniture",
  "Jewellery",
  "Watches & Clocks",
  "Silver & Metalware",
  "Ceramics & Glass",
  "Asian Art",
  "Books & Manuscripts",
  "Rugs & Carpets",
  "Collectibles",
  "Wine & Spirits",
  "Other",
] as const;

export interface Consignor {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

/** Fields used by the consignor lookup/picker at intake. */
export type ConsignorSummary = Pick<
  Consignor,
  "id" | "full_name" | "email" | "phone"
>;

export interface ConsignmentItem {
  id: string;
  consignment_id: string;
  reference: string;
  lot_barcode: string;
  title: string;
  description: string | null;
  category: string | null;
  height_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  weight_kg: number | null;
  status: ConsignmentStatus;
  responsible_manager: string | null;
  received_at: string;
  appraisal_due_at: string | null;
  created_at: string;
}

/** Days remaining in the appraisal window (negative = overdue). */
export function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const ms = new Date(dateIso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function appraisalUrgency(
  status: ConsignmentStatus,
  appraisalDueAt: string | null,
): "overdue" | "soon" | "ok" | null {
  if (status !== "awaiting_appraisal" && status !== "extended_review")
    return null;
  const d = daysUntil(appraisalDueAt);
  if (d === null) return null;
  if (d < 0) return "overdue";
  if (d <= 3) return "soon";
  return "ok";
}

export function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatDate(dateIso: string | null): string {
  if (!dateIso) return "—";
  return new Date(dateIso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
