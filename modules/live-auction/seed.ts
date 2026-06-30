// Seed one live auction with lots, an approved paddle, and an absentee bid so
// the module can be demoed end-to-end. Run: npm run auction-seed
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./server/env";

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const aud = supabase.schema("auction");

async function main() {
  const { data: admin } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "admin")
    .limit(1)
    .single();
  if (!admin) throw new Error("No admin profile found — create one first.");

  const { data: auction, error: aErr } = await aud
    .from("auctions")
    .insert({
      title: "AlBahie Inaugural Live Sale",
      status: "live",
      soft_close_seconds: 30,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (aErr || !auction) throw aErr;

  const lots = [
    { lot_no: 1, title: "Persian Silk Qum Rug", description: "Fine hand-knotted silk, c.1960", start: 50_000, reserve: 80_000, low: 80_000, high: 120_000 },
    { lot_no: 2, title: "Patek Philippe Calatrava", description: "18k yellow gold, ref. 3796", start: 200_000, reserve: 400_000, low: 400_000, high: 600_000 },
    { lot_no: 3, title: "Qajar Lacquer Mirror Case", description: "Painted papier-mâché, 19th c.", start: 30_000, reserve: null, low: 40_000, high: 70_000 },
  ];

  const { data: insertedLots, error: lErr } = await aud
    .from("lots")
    .insert(
      lots.map((l, i) => ({
        auction_id: auction.id,
        lot_no: l.lot_no,
        title: l.title,
        description: l.description,
        start_price_cents: l.start,
        reserve_cents: l.reserve,
        low_estimate_cents: l.low,
        high_estimate_cents: l.high,
        sort_order: i,
      })),
    )
    .select("id, lot_no");
  if (lErr || !insertedLots) throw lErr;

  const { data: reg, error: rErr } = await aud
    .from("registrations")
    .insert({
      auction_id: auction.id,
      user_id: admin.id,
      paddle_no: 100,
      status: "approved",
    })
    .select("id")
    .single();
  if (rErr || !reg) throw rErr;

  // Absentee max on lot 2 so it auto-opens via the proxy engine.
  const lot2 = insertedLots.find((l) => l.lot_no === 2)!;
  await aud.from("absentee_bids").insert({
    lot_id: lot2.id,
    registration_id: reg.id,
    max_amount_cents: 450_000,
  });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  console.log("\n✓ Seeded live auction\n");
  console.log(`  Admin paddle:  #100 (${admin.full_name || admin.email})`);
  console.log(`  Bidder UI:     ${base}/auctions/${auction.id}/live`);
  console.log(`  Console:       ${base}/auctions/${auction.id}/console`);
  console.log(`  Catalog admin: ${base}/auctions/admin\n`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("Seed failed:", e.message ?? e);
    process.exit(1);
  },
);
