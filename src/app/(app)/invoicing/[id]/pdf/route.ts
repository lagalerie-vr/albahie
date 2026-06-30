import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import type { Invoice } from "@/lib/invoices";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!data) return new NextResponse("Not found", { status: 404 });

  const inv = data as Invoice;
  const bytes = await buildInvoicePdf(inv);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${inv.invoice_number ?? "invoice"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
