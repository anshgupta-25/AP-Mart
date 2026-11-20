import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-side image upload/delete for the public image buckets.
//
// Uploading straight from the browser depends on Storage RLS policies on
// storage.objects, which are easy to get out of sync with the migrations. Here
// the server decides the folder from the caller's verified identity and writes
// with the service role, so the per-shop rule is enforced in code:
//   - shopkeeper -> shops/<the shop they own>/ only
//   - admin / super_admin -> catalog/ or any shops/<id>/
// The service-role key never leaves the server.

export const IMAGE_BUCKETS = ["products", "categories", "offers", "shop-collections"] as const;
export type ImageBucket = (typeof IMAGE_BUCKETS)[number];

const MAX_BYTES = 10 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SHOP_FOLDER = new RegExp(`^shops/(${UUID})$`, "i");

/** Checks the file's leading bytes match its declared image type. */
function matchesType(bytes: Uint8Array, type: string) {
  const at = (i: number, ...v: number[]) => v.every((b, k) => bytes[i + k] === b);
  switch (type) {
    case "image/jpeg":
      return at(0, 0xff, 0xd8, 0xff);
    case "image/png":
      return at(0, 0x89, 0x50, 0x4e, 0x47);
    case "image/gif":
      return at(0, 0x47, 0x49, 0x46, 0x38);
    case "image/webp":
      return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
    default:
      return false;
  }
}

type Caller = { isAdmin: boolean; shopId: string | null };

async function loadCaller(userId: string): Promise<Caller> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [roles, shop] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("shops").select("id").eq("owner_id", userId).limit(1).maybeSingle(),
  ]);
  if (roles.error) throw new Error("Could not verify your account. Please try again.");
  const list = (roles.data ?? []).map((r) => String(r.role));
  const isAdmin = list.includes("admin") || list.includes("super_admin");
  const isShopkeeper = list.includes("shopkeeper");
  return { isAdmin, shopId: isShopkeeper ? (shop.data?.id ?? null) : null };
}

/** The folder this caller may write to, honouring `requested` only when allowed. */
function allowedFolder(caller: Caller, requested?: string): string {
  const folder = requested?.replace(/^\/+|\/+$/g, "");
  if (caller.isAdmin) {
    if (!folder || folder === "catalog" || SHOP_FOLDER.test(folder)) return folder || "catalog";
    throw new Error("Invalid upload folder.");
  }
  if (!caller.shopId) {
    throw new Error(
      "Only shop owners and admins can upload images. Ask an admin to assign your shop.",
    );
  }
  const own = `shops/${caller.shopId}`;
  if (folder && folder !== own) throw new Error("You can only upload images for your own shop.");
  return own;
}

function isImageBucket(value: unknown): value is ImageBucket {
  return typeof value === "string" && (IMAGE_BUCKETS as readonly string[]).includes(value);
}

export const uploadImageObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { bucket: string; contentType: string; data: string; folder?: string }) => {
      if (!isImageBucket(input?.bucket)) throw new Error("Unsupported image bucket.");
      if (!EXT_BY_TYPE[input?.contentType])
        throw new Error("Only JPG, PNG, WEBP or GIF images are allowed.");
      if (
        typeof input.data !== "string" ||
        input.data.length > Math.ceil((MAX_BYTES * 4) / 3) + 4
      ) {
        throw new Error("Image exceeds the 10 MB limit.");
      }
      if (input.folder !== undefined && typeof input.folder !== "string")
        throw new Error("Invalid folder.");
      return input as { bucket: ImageBucket; contentType: string; data: string; folder?: string };
    },
  )
  .handler(async ({ data, context }) => {
    const bytes = new Uint8Array(Buffer.from(data.data, "base64"));
    if (bytes.byteLength === 0) throw new Error("The image file is empty.");
    if (bytes.byteLength > MAX_BYTES) throw new Error("Image exceeds the 10 MB limit.");
    if (!matchesType(bytes, data.contentType)) {
      throw new Error("The file is not a valid JPG, PNG, WEBP or GIF image.");
    }

    const caller = await loadCaller(context.userId);
    const folder = allowedFolder(caller, data.folder);
    const path = `${folder}/${crypto.randomUUID()}.${EXT_BY_TYPE[data.contentType]}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from(data.bucket).upload(path, bytes, {
      contentType: data.contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      console.error(`[storage.${data.bucket}.upload] failed:`, error.message);
      throw new Error(`Image upload failed: ${error.message}`);
    }
    return { bucket: data.bucket, path };
  });

export const removeImageObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bucket: string; path: string }) => {
    if (!isImageBucket(input?.bucket)) throw new Error("Unsupported image bucket.");
    if (typeof input.path !== "string" || input.path.includes("..") || input.path.length > 300) {
      throw new Error("Invalid path.");
    }
    return input as { bucket: ImageBucket; path: string };
  })
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.userId);
    const folder = data.path.split("/").slice(0, -1).join("/");
    allowedFolder(caller, folder); // throws if the caller may not touch this folder
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from(data.bucket).remove([data.path]);
    if (error) throw new Error(`Could not delete image: ${error.message}`);
    return { ok: true };
  });
