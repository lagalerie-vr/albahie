export const KYC_DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "driver_license", label: "Driver's license" },
  { value: "company_reg", label: "Company registration" },
  { value: "other", label: "Other" },
] as const;

export const KYC_STATUSES = ["pending", "verified", "rejected", "expired"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

/** Aggregate KYC standing for a client, derived from their records. */
export type ClientKycStanding = "none" | KycStatus;

export interface KycRecord {
  id: string;
  consignor_id: string;
  doc_type: string;
  doc_number: string | null;
  doc_country: string | null;
  status: KycStatus;
  expires_at: string | null;
  notes: string | null;
  file_path: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface ClientRow extends Client {
  sales_count: number; // consignments brought in (seller)
  buyer_count: number; // auctions registered for (buyer)
  kyc: ClientKycStanding;
}

export function docTypeLabel(v: string): string {
  return KYC_DOC_TYPES.find((d) => d.value === v)?.label ?? v;
}

/** Reduce a client's KYC records to a single standing (best wins). */
export function kycStanding(statuses: string[]): ClientKycStanding {
  if (statuses.includes("verified")) return "verified";
  if (statuses.includes("pending")) return "pending";
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("expired")) return "expired";
  return "none";
}
