// Dev-only: fails if the working tree lost any RPC, table, realtime channel, server function or route link
// that exists on the base ref (default HEAD / main). Usage: node scripts/parity-check.mjs [baseRef]
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] ?? "HEAD";
const tmp = mkdtempSync(join(tmpdir(), "parity-"));
execSync(`git archive ${base} src | tar -x -C ${tmp}`, { stdio: "pipe" });

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/routeTree\.gen|integrations\/supabase\/types/.test(p)) out.push(p);
  }
  return out;
}
const LINK = /["'`](\/(?:customer|shopkeeper|delivery|support|admin|super-admin|superadmin|orders|account|products|category|product|checkout|cart|favourites|wishlist|login|signup|staff-login|dashboard|app|auth|reset-password)[\w\-/$.]*)/g;
function scan(root) {
  const r = { rpc: new Set(), table: new Set(), channel: new Set(), fn: new Set(), link: new Set(), routes: new Set() };
  for (const f of walk(root)) {
    const s = readFileSync(f, "utf8");
    if (f.includes("/routes/")) r.routes.add(f.split("/routes/")[1]);
    for (const m of s.matchAll(/\.rpc\(\s*["'](\w+)["']/g)) r.rpc.add(m[1]);
    for (const m of s.matchAll(/\.from\(\s*["'](\w+)["']/g)) r.table.add(m[1]);
    for (const m of s.matchAll(/\.channel\(\s*[`"']([\w-]+)/g)) r.channel.add(m[1]);
    for (const m of s.matchAll(/\b(createRazorpayOrder|verifyRazorpayPayment|recordPaymentFailure|refundPayment|computeRoute|rankShopsByEta|reverseGeocode|getIntegrationStatus|deleteMyAccount)\b/g)) r.fn.add(m[1]);
    for (const m of s.matchAll(LINK)) r.link.add(m[1].split("?")[0].replace(/\/$/, "") || "/");
  }
  return r;
}
const before = scan(join(tmp, "src"));
const after = scan(join(process.cwd(), "src"));
let lost = 0;
for (const k of Object.keys(before)) {
  const missing = [...before[k]].filter((x) => !after[k].has(x));
  if (missing.length) {
    lost += missing.length;
    console.log(`LOST ${k} (${missing.length}): ${missing.join(", ")}`);
  }
}
console.log(lost ? `\nparity FAILED: ${lost} item(s) present on ${base} are missing now` : `parity OK vs ${base}: ${Object.entries(before).map(([k, v]) => `${v.size} ${k}`).join(", ")}`);
process.exit(lost ? 1 : 0);
