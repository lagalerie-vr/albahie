// Generic SMTP email sender, shared by the standalone WS server (auto-notify on
// sale) and the Next app (manual resend). No "server-only" and no "@/" alias so
// the tsx-run server can import it. A no-op when SMTP isn't configured — so a
// missing mail setup never breaks the sale flow.
import nodemailer, { type Transporter } from "nodemailer";

export function emailConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

let transporter: Transporter | null = null;
function getTransport(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok?: true; skipped?: true; error?: string }> {
  if (!emailConfigured()) return { skipped: true };
  try {
    await getTransport().sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Branded HTML for the "your lot sold — pay your invoice" email. */
export function invoiceEmailHtml(args: {
  buyerName: string | null;
  invoiceNumber: string | null;
  lotTitle: string | null;
  totalLabel: string;
  link: string;
}): string {
  const name = args.buyerName ?? "there";
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0a0a0a">
    <h2 style="margin:0 0 4px">AlBahie Auction House</h2>
    <p style="color:#6b7280;margin:0 0 20px;font-size:13px">Fine art &amp; antiques auctioneers</p>
    <p>Hello ${name},</p>
    <p>Congratulations — you won <strong>${args.lotTitle ?? "your lot"}</strong> at auction.</p>
    <p>Your invoice <strong>${args.invoiceNumber ?? ""}</strong> is ready, total
      <strong>${args.totalLabel}</strong>.</p>
    <p style="margin:24px 0">
      <a href="${args.link}" style="background:#0a0a0a;color:#fff;text-decoration:none;
        padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Pay your invoice</a>
    </p>
    <p style="color:#6b7280;font-size:12px">Or paste this link into your browser:<br/>${args.link}</p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">Thank you — AlBahie Auction House</p>
  </div>`;
}
