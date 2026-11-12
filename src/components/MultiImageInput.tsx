import { useEffect, useRef, useState } from "react";
import { Upload, Star, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/storage";
import { StorageImg } from "@/components/StorageImg";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 6;
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const PRODUCT_IMAGE_BUCKET = "products";

/**
 * Multi-image uploader (1-6 images).
 * `value` is an ordered list of storage:// references (legacy http URLs also accepted); index 0 is the cover.
 * Backed by the `products` Supabase Storage bucket.
 */
export function MultiImageInput({
  value,
  onChange,
  label = "Product images",
  required = true,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  required?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  async function uploadOne(file: File): Promise<string | null> {
    try {
      // New product uploads always go to `products`; `product-images` is legacy.
      const stored = await uploadImage({
        bucket: PRODUCT_IMAGE_BUCKET,
        file,
        allowedTypes: ACCEPTED,
        maxBytes: MAX_SIZE,
      });
      return stored.ref;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${file.name}: upload failed`);
      return null;
    }
  }

  async function handleFiles(files: FileList) {
    const remaining = MAX_IMAGES - value.length;
    if (files.length > remaining) {
      toast.error("You can upload a maximum of 6 images for one product.");
    }
    const slice = Array.from(files).slice(0, remaining);
    if (slice.length === 0) return;
    const acceptedFiles = slice.filter((file) => {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: only JPG, JPEG, PNG or WEBP allowed`);
        return false;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: exceeds 10 MB limit`);
        return false;
      }
      return true;
    });
    if (acceptedFiles.length === 0) return;
    setPreviews(acceptedFiles.map((file) => URL.createObjectURL(file)));
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const file of acceptedFiles) {
        try {
          const url = await uploadOne(file);
          if (url) urls.push(url);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `${file.name}: upload failed`);
        }
      }
      if (urls.length) {
        onChange([...value, ...urls]);
        toast.success(`Uploaded ${urls.length} image${urls.length > 1 ? "s" : ""}`);
      }
    } finally {
      setBusy(false);
      setPreviews([]);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function setCover(i: number) {
    if (i === 0) return;
    const next = [...value];
    const [pick] = next.splice(i, 1);
    next.unshift(pick);
    onChange(next);
  }
  function onDragStart(i: number) {
    setDragIdx(i);
  }
  function onDrop(i: number) {
    if (dragIdx === null || dragIdx === i) return setDragIdx(null);
    const next = [...value];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    onChange(next);
    setDragIdx(null);
  }

  const canAddMore = value.length < MAX_IMAGES;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold">
          {label} {required && <span className="text-destructive">*</span>}
          <span className="ml-2 font-normal text-muted-foreground">
            {value.length}/{MAX_IMAGES}
          </span>
        </label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy || !canAddMore}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1" />
          {busy ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {value.length > 0 && (
        <>
          {/* Cover */}
          <div className="rounded-xl border border-border p-2 bg-secondary/30">
            <div className="text-[11px] font-bold text-muted-foreground mb-1 flex items-center gap-1">
              <Star className="h-3 w-3 fill-current text-yellow-500" /> Cover image
            </div>
            <div className="relative rounded-lg overflow-hidden w-full max-w-[220px] aspect-square bg-card">
              <StorageImg
                loading="lazy"
                decoding="async"
                src={value[0]}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(0)}
                className="absolute top-1 right-1 h-7 w-7 rounded-full bg-background/80 grid place-items-center text-destructive hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Remove cover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Gallery */}
          {value.length > 1 && (
            <div>
              <div className="text-[11px] font-bold text-muted-foreground mb-1">
                Gallery (drag to reorder)
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {value.slice(1).map((url, i) => {
                  const idx = i + 1;
                  return (
                    <div
                      key={url + idx}
                      draggable
                      onDragStart={() => onDragStart(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(idx)}
                      className={cn(
                        "relative shrink-0 w-24 aspect-square rounded-lg overflow-hidden border border-border bg-card group",
                        dragIdx === idx && "opacity-50",
                      )}
                    >
                      <StorageImg
                        loading="lazy"
                        decoding="async"
                        src={url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 top-0 flex justify-between p-1">
                        <span className="h-5 w-5 rounded bg-background/80 grid place-items-center cursor-grab">
                          <GripVertical className="h-3 w-3" />
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="h-5 w-5 rounded bg-background/80 grid place-items-center text-destructive"
                          aria-label="Remove image"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCover(idx)}
                        className="absolute inset-x-0 bottom-0 text-[10px] font-bold py-1 bg-background/85 hover:bg-primary hover:text-primary-foreground flex items-center justify-center gap-1"
                      >
                        <Star className="h-3 w-3" /> Set as cover
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2" aria-live="polite">
          {previews.map((url) => (
            <div
              key={url}
              className="relative shrink-0 w-24 aspect-square rounded-lg overflow-hidden border border-border"
            >
              <img src={url} alt="Selected image preview" className="w-full h-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-background/85 px-1 py-0.5 text-center text-[10px]">
                {busy ? "Uploading…" : "Preview"}
              </span>
            </div>
          ))}
        </div>
      )}

      {required && value.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Upload 1–6 images (JPG, PNG or WEBP, up to 10 MB each). The first image becomes the cover.
        </p>
      )}
    </div>
  );
}
