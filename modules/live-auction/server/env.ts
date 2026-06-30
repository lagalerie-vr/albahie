// Minimal .env.local loader for the standalone server (no extra dependency).
import fs from "node:fs";
import path from "node:path";

export function loadEnv(): void {
  const file = path.resolve(process.cwd(), ".env.local");
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}
