#!/usr/bin/env node
/**
 * Admin CLI for bootstrapping and inviting ERP users.
 * Uses the Supabase service-role key — run locally only, never in the browser.
 *
 * Usage:
 *   node scripts/admin.mjs create-admin <email> <password> ["Full Name"]
 *   node scripts/admin.mjs invite <email> [staff|admin] ["Full Name"]
 *   node scripts/admin.mjs set-role <email> <staff|admin>
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SITE_URL (for invite redirect)
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (no extra dependency).
function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // ignore — env may be set another way
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  // Paginate through users to find a match (admin API has no direct lookup).
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function createAdmin(email, password, fullName) {
  if (!email || !password) {
    console.error('Usage: create-admin <email> <password> ["Full Name"]');
    process.exit(1);
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? null, role: "admin" },
  });
  if (error) throw error;
  // The DB trigger creates the profile; make sure role is admin.
  await supabase.from("profiles").update({ role: "admin", full_name: fullName ?? null }).eq("id", data.user.id);
  console.log(`✓ Admin created: ${email}`);
}

async function invite(email, role = "staff", fullName) {
  if (!email) {
    console.error('Usage: invite <email> [staff|admin] ["Full Name"]');
    process.exit(1);
  }
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName ?? null, role },
    redirectTo: `${siteUrl}/auth/confirm`,
  });
  if (error) throw error;
  if (role === "admin") {
    await supabase.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  }
  console.log(`✓ Invite sent to ${email} (${role}). They'll set a password via email link.`);
}

async function setRole(email, role) {
  if (!email || !["staff", "admin"].includes(role)) {
    console.error("Usage: set-role <email> <staff|admin>");
    process.exit(1);
  }
  const user = await findUserByEmail(email);
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  const { error } = await supabase.from("profiles").update({ role }).eq("id", user.id);
  if (error) throw error;
  console.log(`✓ ${email} is now ${role}`);
}

const [cmd, ...args] = process.argv.slice(2);

try {
  switch (cmd) {
    case "create-admin":
      await createAdmin(args[0], args[1], args[2]);
      break;
    case "invite":
      await invite(args[0], args[1], args[2]);
      break;
    case "set-role":
      await setRole(args[0], args[1]);
      break;
    default:
      console.log(
        [
          "AlBahie ERP admin CLI",
          "",
          "Commands:",
          '  create-admin <email> <password> ["Full Name"]',
          '  invite <email> [staff|admin] ["Full Name"]',
          "  set-role <email> <staff|admin>",
        ].join("\n"),
      );
  }
} catch (err) {
  console.error("Error:", err.message ?? err);
  process.exit(1);
}
