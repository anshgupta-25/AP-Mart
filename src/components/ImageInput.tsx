import { useEffect, useRef, useState } from "react";
import { Upload, Link as LinkIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/storage";
import { StorageImg } from "@/components/StorageImg";
import { toast } from "sonner";

type Bucket = "product-images" | "products" | "categories" | "offers" | "shop-collections";
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Combined image input: paste a URL OR upload a file.
 * Either source produces a usable URL that is written back via `onChange`.
 * Validation note: caller must require a non-empty value before saving.
 */
export function ImageInput({
  value,
  onChange,
  bucket,
  label = "Image",
  required = true,
  maxEdge,
}: {
  value: string;
  onChange: (url: string) => void;
  bucket: Bucket;
  label?: string;
  required?: boolean;
  /** Longest image edge after upload; defaults by bucket (see uploadImage). */
  maxEdge?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (file: File) => {
    if (!file) return;
    setPreviewUrl(null);
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      toast.error("Choose a JPG, PNG, WEBP or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be ≤5 MB");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setBusy(true);
    try {
      // New product uploads always go to `products`; `product-images` is legacy.
      const target = bucket === "product-images" ? "products" : bucket;
      const stored = await uploadImage({
        bucket: target,
        file,
        maxBytes: 5 * 1024 * 1024,
        maxEdge,
      });
      onChange(stored.ref);
      setPreviewUrl(null); // the saved reference renders immediately via StorageImg
      toast.success("Uploaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message, { duration: 8000 });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-meta font-medium text-foreground/80">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => {
              setPreviewUrl(null);
              onChange("");
            }}
            className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => {
              setPreviewUrl(null);
              onChange(e.target.value);
            }}
            placeholder="https://… or upload below"
            className="pl-10"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="shrink-0"
        >
          <Upload className="h-4 w-4 mr-1" />
          {busy ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
      {(previewUrl || value) && (
        <div className="w-full max-w-xs overflow-hidden rounded-xl bg-secondary">
          <StorageImg
            loading="lazy"
            decoding="async"
            src={previewUrl ?? value}
            alt=""
            className="w-full h-32 object-cover"
          />
          {busy && <p className="px-2 py-1 text-xs text-muted-foreground">Uploading image…</p>}
        </div>
      )}
      {required && !value && (
        <p className="text-caption text-muted-foreground">
          Paste a URL or upload a file — one is required.
        </p>
      )}
    </div>
  );
}
