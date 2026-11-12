// DEV-ONLY, idempotent seed of the six role test accounts.
// Uses the Supabase Auth Admin API, so it needs the service-role key. Put it in a
// git-ignored .env.migration (or the shell) - never in frontend code:
//   TARGET_URL=https://<ref>.supabase.co
//   TARGET_SERVICE_ROLE_KEY=...
// Run:  node scripts/seed-test-accounts.mjs --yes
import fs from "node:fs";

if (fs.existsSync(".env.migration")) {
  for (const l of fs.readFileSync(".env.migration", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const URL_ = process.env.TARGET_URL, KEY = process.env.TARGET_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error("Missing TARGET_URL / TARGET_SERVICE_ROLE_KEY (see header)."); process.exit(1); }
if (!process.argv.includes("--yes")) { console.error(`Dry guard: this creates 6 confirmed test users in ${URL_}. Re-run with --yes.`); process.exit(1); }

const PASSWORD = process.env.TEST_ACCOUNT_PASSWORD || "FlashTest@2026!";
const ACCOUNTS = [
  { key: "customer", email: "customer.test@example.com", name: "Test Customer", role: "customer" },
  { key: "delivery", email: "delivery.test@example.com", name: "Test Delivery Partner", role: "delivery" },
  { key: "support", email: "support.test@example.com", name: "Test Support Agent", role: "support" },
  { key: "shopkeeper", email: "shopkeeper.test@example.com", name: "Test Shopkeeper", role: "shopkeeper" },
  { key: "admin", email: "admin.test@example.com", name: "Test Admin", role: "admin" },
  { key: "superadmin", email: "superadmin.test@example.com", name: "Test Super Admin", role: "super_admin" },
];
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const call = async (path, init = {}) => {
  const r = await fetch(`${URL_}${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  let body; try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  if (!r.ok) throw new Error(`${init.method || "GET"} ${path} -> ${r.status} ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
};
const rest = (table, qs = "", init = {}) => call(`/rest/v1/${table}${qs}`, { ...init, headers: { Prefer: "return=representation,resolution=merge-duplicates", ...(init.headers || {}) } });

async function findUser(email) {
  for (let page = 1; page < 20; page++) {
    const res = await call(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = res.users ?? [];
    const hit = users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

const results = [];
for (const a of ACCOUNTS) {
  try {
    let user = await findUser(a.email);
    let created = false;
    if (!user) {
      user = await call("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: a.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: a.name } }) });
      created = true;
    } else {
      // keep the test password known and the email confirmed on reruns
      await call(`/auth/v1/admin/users/${user.id}`, { method: "PUT", body: JSON.stringify({ password: PASSWORD, email_confirm: true }) });
    }
    const id = user.id;
    await rest("profiles", "?on_conflict=id", { method: "POST", body: JSON.stringify({ id, full_name: a.name, email: a.email }) });
    await rest("user_roles", "?on_conflict=user_id,role", { method: "POST", body: JSON.stringify({ user_id: id, role: a.role }) });
    if (a.key === "support") await rest("support_agents", "?on_conflict=user_id", { method: "POST", body: JSON.stringify({ user_id: id, display_name: a.name, is_active: true }) });
    if (a.key === "shopkeeper") {
      const ex = await rest("shops", `?owner_id=eq.${id}&select=id`);
      if (!ex.length) await rest("shops", "", { method: "POST", body: JSON.stringify({ owner_id: id, name: "Test Shop", address: "1 Test Street", city: "Noida", state: "Uttar Pradesh", pincode: "201301", phone: "9999999999", latitude: 28.5355, longitude: 77.391 }) });
    }
    if (a.key === "delivery") {
      const ex = await rest("delivery_partners", `?user_id=eq.${id}&select=id`);
      if (!ex.length) await rest("delivery_partners", "", { method: "POST", body: JSON.stringify({ user_id: id, name: a.name, phone: "9999999998", vehicle: "Bike" }) });
    }
    results.push(`${created ? "created " : "existing"}  ${a.role.padEnd(11)} ${a.email}`);
  } catch (e) {
    results.push(`FAILED    ${a.role.padEnd(11)} ${a.email}  ${String(e.message).slice(0, 300)}`);
  }
}
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAILED")) ? 1 : 0);
