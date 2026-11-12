import { supabase } from "@/integrations/supabase/client";
import { describeError } from "@/lib/dbError";

/**
 * Centralized Supabase Storage service.
 *
 * - Every browser upload goes through `uploadFile` / `uploadImage` (governed by Storage RLS,
 *   using the signed-in user's session; no service-role key is ever used here).
 * - Database columns store a stable reference `storage://<bucket>/<path>` instead of a signed URL.
 * - `resolveStorageUrl` turns a reference into a displayable URL (signed for private buckets),
 *   caches it until shortly before expiry and passes plain http(s)/data/blob URLs through.
 */

export type StorageBucket =
  | "products"
  | "categories"
  | "offers"
  | "shop-collections"
  | "support-attachments"
  /** Legacy bucket: read-only for display of old references, never used for new uploads. */
  | "product-images";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const SCHEME = "storage://";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // re-sign 5 min before expiry

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export interface StoredObject {
  bucket: StorageBucket;
  path: string;
  /** Stable reference to persist in the database: `storage://bucket/path`. */
  ref: string;
  /** Short-lived URL suitable for immediate display. */
  url: string;
}

/* ------------------------------------------------------------------ references */

export function toStorageRef(bucket: string, path: string): string {
  return `${SCHEME}${bucket}/${path.replace(/^\/+/, "")}`;
}

export function isStorageRef(value: string | null | undefined): value is string {
  return !!value && value.startsWith(SCHEME);
}

const KNOWN_BUCKETS = new Set([
  "products",
  "categories",
  "offers",
  "shop-collections",
  "support-attachments",
  "product-images",
]);
const SUPABASE_OBJECT_URL =
  /^https?:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/(?:sign|public|authenticated)\/([a-z0-9-]+)\/([^?#]+)/i;

/**
 * Stored values may still be full Supabase Storage URLs from the old (Lovable) project, or
 * signed URLs whose token expired / was redacted. Those can never load, so map them to a
 * `storage://` reference and sign them against the CURRENT project. Other URLs are untouched.
 */
export function normalizeImageValue(value: string | null | undefined): string | null {
  if (!value) return null;
  if (isStorageRef(value)) return value;
  const m = SUPABASE_OBJECT_URL.exec(value);
  if (!m || !KNOWN_BUCKETS.has(m[1])) return value;
  try {
    return toStorageRef(m[1], decodeURIComponent(m[2]));
  } catch {
    return value;
  }
}

export function parseStorageRef(value: string): { bucket: StorageBucket; path: string } | null {
  if (!isStorageRef(value)) return null;
  const rest = value.slice(SCHEME.length);
  const slash = rest.indexOf("/");
  if (slash <= 0 || slash === rest.length - 1) return null;
  return { bucket: rest.slice(0, slash) as StorageBucket, path: rest.slice(slash + 1) };
}

/* ------------------------------------------------------------------ signed URL resolver */

interface CacheEntry {
  url: string;
  expiresAt: number;
}
const urlCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();
const pending = new Map<string, Array<{ path: string; ref: string; resolve: (u: string | null) => void }>>();
let flushScheduled = false;

function flushPending() {
  flushScheduled = false;
  const batches = Array.from(pending.entries());
  pending.clear();
  for (const [bucket, items] of batches) {
    const paths = Array.from(new Set(items.map((i) => i.path)));
    supabase.storage
      .from(bucket)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
      .then(({ data, error }) => {
        const byPath = new Map<string, string>();
        if (!error && data) {
          for (const row of data) {
            if (row.path && row.signedUrl && !row.error) byPath.set(row.path, row.signedUrl);
          }
        }
        const expiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
        for (const item of items) {
          const url = byPath.get(item.path) ?? null;
          if (url) urlCache.set(item.ref, { url, expiresAt });
          item.resolve(url);
        }
      })
      .catch(() => items.forEach((i) => i.resolve(null)));
  }
}

function signLater(bucket: string, path: string, ref: string): Promise<string | null> {
  return new Promise((resolve) => {
    const list = pending.get(bucket) ?? [];
    list.push({ path, ref, resolve });
    pending.set(bucket, list);
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(flushPending, 0); // batch every ref requested in the same tick
    }
  });
}

/** Cached, synchronous lookup (null if absent or about to expire). */
export function peekStorageUrl(raw: string | null | undefined): string | null {
  const value = normalizeImageValue(raw);
  if (!value) return null;
  if (!isStorageRef(value)) return value;
  const hit = urlCache.get(value);
  return hit && hit.expiresAt - Date.now() > REFRESH_MARGIN_MS ? hit.url : null;
}

/**
 * Resolve any stored image value to a displayable URL.
 * storage:// references are signed (and cached); other values pass through unchanged.
 */
export async function resolveStorageUrl(
  raw: string | null | undefined,
  opts: { force?: boolean } = {},
): Promise<string | null> {
  const value = normalizeImageValue(raw);
  if (!value) return null;
  if (!isStorageRef(value)) return value;
  if (!opts.force) {
    const cached = peekStorageUrl(value);
    if (cached) return cached;
    const running = inflight.get(value);
    if (running) return running;
  }
  const parsed = parseStorageRef(value);
  if (!parsed) return null;
  const promise = signLater(parsed.bucket, parsed.path, value).finally(() => {
    inflight.delete(value);
  });
  inflight.set(value, promise);
  return promise;
}

/** Drop a cached URL (e.g. after the image failed to load because the signature expired). */
export function invalidateStorageUrl(value: string | null | undefined) {
  if (value) urlCache.delete(value);
}

/* ------------------------------------------------------------------ upload */

export interface UploadOptions {
  bucket: StorageBucket;
  file: File;
  /** Sub-folder inside the bucket. Defaults to the caller's shop folder, or `catalog`. */
  folder?: string;
  allowedTypes?: readonly string[];
  maxBytes?: number;
  retries?: number;
}

const ownShopCache = new Map<string, string | null>();

/**
 * Shopkeepers may only write below `shops/<their shop id>/` (enforced by Storage RLS);
 * everyone else (admins) writes below `catalog/`.
 */
async function defaultFolder(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return "catalog";
  if (!ownShopCache.has(uid)) {
    const { data } = await supabase.from("shops").select("id").eq("owner_id", uid).maybeSingle();
    ownShopCache.set(uid, data?.id ?? null);
  }
  const shopId = ownShopCache.get(uid);
  return shopId ? `shops/${shopId}` : "catalog";
}

function extensionFor(file: File): string {
  const fromMime = EXT_BY_MIME[file.type];
  if (fromMime) return fromMime;
  const fromName = file.name.split(".").pop()?.toLowerCase();
  return fromName && /^[a-z0-9]{1,5}$/.test(fromName) ? fromName : "bin";
}

const sessionUploads = new Map<string, StoredObject>(); // dedupe identical files in this session
const ownedThisSession = new Set<string>();

function isTransient(err: any): boolean {
  const status = Number(err?.statusCode ?? err?.status);
  if (Number.isFinite(status) && status >= 400 && status < 500) return false;
  return true;
}

export function validateFile(
  file: File,
  allowedTypes: readonly string[] = IMAGE_TYPES,
  maxBytes = 5 * 1024 * 1024,
): string | null {
  if (!allowedTypes.includes(file.type)) {
    return `${file.name}: unsupported file type`;
  }
  if (file.size > maxBytes) {
    return `${file.name}: exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit`;
  }
  return null;
}

export async function uploadFile(opts: UploadOptions): Promise<StoredObject> {
  const { bucket, file, retries = 2 } = opts;
  const invalid = validateFile(file, opts.allowedTypes, opts.maxBytes);
  if (invalid) throw new Error(invalid);

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? "anon";
  const folder = (opts.folder ?? (await defaultFolder())).replace(/^\/+|\/+$/g, "");

  const fingerprint = `${uid}|${bucket}|${folder}|${file.name}|${file.size}|${file.lastModified}`;
  const known = sessionUploads.get(fingerprint);
  if (known) {
    const url = await resolveStorageUrl(known.ref);
    if (url) return { ...known, url };
  }

  const path = `${folder}/${crypto.randomUUID()}.${extensionFor(file)}`;
  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "31536000",
      upsert: false, // never overwrite
      contentType: file.type,
    });
    if (!error) {
      lastError = null;
      break;
    }
    lastError = error;
    if (!isTransient(error) || attempt === retries) break;
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
  if (lastError) {
    throw describeError(lastError, `storage.${bucket}.upload`, {
      path,
      type: file.type,
      size: file.size,
    });
  }

  const ref = toStorageRef(bucket, path);
  const url = await resolveStorageUrl(ref, { force: true });
  if (!url) {
    throw describeError(new Error("Could not create a display URL"), `storage.${bucket}.sign`, {
      path,
    });
  }
  const stored: StoredObject = { bucket, path, ref, url };
  sessionUploads.set(fingerprint, stored);
  ownedThisSession.add(ref);
  return stored;
}

export function uploadImage(opts: UploadOptions): Promise<StoredObject> {
  return uploadFile({ ...opts, allowedTypes: opts.allowedTypes ?? IMAGE_TYPES });
}

/**
 * Remove an object that was uploaded in this session (e.g. replaced before saving).
 * References to pre-existing objects are never deleted: they may be shared by other records.
 */
export async function removeUploadedObject(ref: string): Promise<boolean> {
  if (!ownedThisSession.has(ref)) return false;
  const parsed = parseStorageRef(ref);
  if (!parsed) return false;
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) return false;
  ownedThisSession.delete(ref);
  invalidateStorageUrl(ref);
  for (const [k, v] of sessionUploads) if (v.ref === ref) sessionUploads.delete(k);
  return true;
}
