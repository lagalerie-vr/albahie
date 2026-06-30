import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Invoice } from "@/lib/invoices";

const usd = (c: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(c / 100);

/** Build a branded A4 PDF invoice for a sale. Works for paid or unpaid. */
export async function buildInvoicePdf(inv: Invoice): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.05, 0.05, 0.05);
  const muted = rgb(0.45, 0.45, 0.45);
  const lineCol = rgb(0.85, 0.85, 0.85);
  const M = 56;
  const right = width - M;
  let y = 790;

  const draw = (
    s: string,
    x: number,
    size: number,
    f = font,
    color = ink,
  ) => page.drawText(s, { x, y, size, font: f, color });
  const drawR = (
    s: string,
    size: number,
    f = font,
    color = ink,
  ) => page.drawText(s, { x: right - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  const rule = () => {
    page.drawLine({ start: { x: M, y }, end: { x: right, y }, thickness: 1, color: lineCol });
  };

  // Header
  draw("AlBahie Auction House", M, 18, bold);
  drawR("INVOICE", 18, bold, muted);
  y -= 15;
  draw("Fine art & antiques auctioneers", M, 9, font, muted);
  y -= 34;

  // Status + meta
  const paid = inv.status === "settled";
  drawR(paid ? "PAID" : "PAYMENT DUE", 12, bold, paid ? rgb(0.06, 0.5, 0.2) : rgb(0.7, 0.4, 0.03));
  draw("Invoice no.", M, 9, font, muted);
  page.drawText(inv.invoice_number ?? "—", { x: M + 72, y, size: 10, font: bold, color: ink });
  y -= 15;
  draw("Issued", M, 9, font, muted);
  page.drawText(new Date(inv.created_at).toLocaleDateString(), {
    x: M + 72,
    y,
    size: 10,
    font,
    color: ink,
  });
  y -= 34;

  // Bill to
  draw("BILL TO", M, 9, bold, muted);
  y -= 15;
  draw(inv.buyer_name ?? "Buyer", M, 12, bold);
  if (inv.paddle_no != null) {
    y -= 14;
    draw(`Paddle #${inv.paddle_no}`, M, 10, font, muted);
  }
  y -= 36;

  // Line items
  rule();
  y -= 16;
  draw("DESCRIPTION", M, 9, bold, muted);
  drawR("AMOUNT", 9, bold, muted);
  y -= 8;
  rule();
  y -= 22;

  const row = (label: string, amount: number) => {
    draw(label, M, 11);
    drawR(usd(amount), 11);
    y -= 20;
  };
  row(inv.lot_title ?? "Lot — hammer price", inv.hammer_cents);
  if (inv.premium_cents > 0) row("Buyer's premium", inv.premium_cents);

  y -= 4;
  rule();
  y -= 24;
  draw("Total", M, 13, bold);
  drawR(usd(inv.total_cents), 13, bold);
  y -= 40;

  draw(
    paid
      ? `Paid${inv.paid_at ? ` on ${new Date(inv.paid_at).toLocaleString()}` : ""}.`
      : "Payment due within 7 days of the sale date.",
    M,
    10,
    font,
    paid ? rgb(0.06, 0.5, 0.2) : muted,
  );

  // Footer
  y = 70;
  draw("Thank you for your business.", M, 9, font, muted);
  y = 56;
  draw("AlBahie Auction House · Main Saleroom", M, 8, font, muted);

  return pdf.save();
}
