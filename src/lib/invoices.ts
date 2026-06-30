export const BUYER_PREMIUM_RATE = 0.2;

export type InvoiceStatus = "unpaid" | "settled";

export interface Invoice {
  id: string;
  invoice_number: string | null;
  auction_id: string | null;
  lot_id: string | null;
  client_id: string | null;
  buyer_name: string | null;
  paddle_no: number | null;
  lot_title: string | null;
  hammer_cents: number;
  premium_cents: number;
  total_cents: number;
  status: InvoiceStatus;
  payment_link: string | null;
  paid_at: string | null;
  stripe_invoice_id: string | null;
  stripe_customer_id: string | null;
  stripe_status: string | null;
  created_at: string;
}

export function fmtCents(c: number | null | undefined): string {
  if (c == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(c / 100);
}
