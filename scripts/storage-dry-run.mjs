// Read-only dry run: classifies image references found in supabase-export/*.sql.
// Optional target check (needs TARGET_URL + TARGET_SERVICE_ROLE_KEY from a git-ignored
// .env.migration or the environment). Writes nothing and copies nothing.
import fs from "node:fs";
import path from "node:path";

const envFile = ".env.migration";
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const dir = "supabase-export";
const re =
  /https:\/\/([a-z0-9]+)\.supabase\.co\/storage\/v1\/object\/(sign|public|authenticated)\/([a-z0-9-]+)\/([^?"'\s]+)/g;
const refs = new Map();
const foreignHosts = new Map();
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
  const text = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of text.matchAll(re)) {
    const key = `${m[3]}/${decodeURIComponent(m[4])}`;
    const e = refs.get(key) ?? { project: m[1], mode: m[2], count: 0, files: new Set() };
    e.count++;
    e.files.add(f);
    refs.set(key, e);
  }
  for (const m of text.matchAll(
    /"(?:image_url|cover_image|logo_url|avatar_url|file_url)":\s*"(https?:\/\/(?!\w+\.supabase\.co)[^"]+)"/g,
  )) {
    const h = new URL(m[1]).host;
    foreignHosts.set(h, (foreignHosts.get(h) ?? 0) + 1);
  }
}
const known = new Set([
  "products",
  "categories",
  "offers",
  "shop-collections",
  "support-attachments",
]);
const report = {
  uniqueObjects: refs.size,
  byBucket: {},
  byProject: {},
  bucketMismatch: [],
  externalHosts: Object.fromEntries(foreignHosts),
  targetCheck: "skipped (no target credentials)",
  missingInTarget: [],
};
for (const [k, v] of refs) {
  const b = k.split("/")[0];
  report.byBucket[b] = (report.byBucket[b] ?? 0) + 1;
  report.byProject[v.project] = (report.byProject[v.project] ?? 0) + 1;
  if (!known.has(b)) report.bucketMismatch.push(k);
}
const url = process.env.TARGET_URL,
  key = process.env.TARGET_SERVICE_ROLE_KEY;
if (url && key) {
  report.targetCheck = "done";
  for (const k of refs.keys()) {
    const i = k.indexOf("/");
    const b = k.slice(0, i),
      p = k.slice(i + 1);
    const r = await fetch(`${url}/storage/v1/object/info/${b}/${p}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) report.missingInTarget.push(k);
  }
}
fs.writeFileSync(
  "storage-dry-run-report.json",
  JSON.stringify({ ...report, objects: [...refs.keys()] }, null, 2),
);
console.log(JSON.stringify(report, null, 2));
