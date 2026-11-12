import { Plus, Trash2, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MultiImageInput } from "@/components/MultiImageInput";

export type VariantDraft = {
  id?: string;
  name: string;
  size: string;
  unit: string;
  sku: string;
  barcode: string;
  weight: string;
  mrp: number;
  selling_price: number;
  retail_price: number;
  stock: number;
  images: string[];
  is_available: boolean;
  is_default: boolean;
  display_order: number;
  _deleted?: boolean;
};

export function emptyVariant(order = 0): VariantDraft {
  return {
    name: "",
    size: "",
    unit: "",
    sku: "",
    barcode: "",
    weight: "",
    mrp: 0,
    selling_price: 0,
    retail_price: 0,
    stock: 0,
    images: [],
    is_available: true,
    is_default: order === 0,
    display_order: order,
  };
}

export function VariantsEditor({
  variants,
  onChange,
}: {
  variants: VariantDraft[];
  onChange: (next: VariantDraft[]) => void;
}) {
  const visible = variants.filter((v) => !v._deleted);

  const add = () => onChange([...variants, emptyVariant(visible.length)]);

  const update = (idx: number, patch: Partial<VariantDraft>) => {
    const next = variants.slice();
    // map visible idx → real idx
    const realIdx = variants.indexOf(visible[idx]);
    next[realIdx] = { ...next[realIdx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = variants.slice();
    const realIdx = variants.indexOf(visible[idx]);
    if (next[realIdx].id) next[realIdx] = { ...next[realIdx], _deleted: true };
    else next.splice(realIdx, 1);
    onChange(next);
  };

  const duplicate = (idx: number) => {
    const src = visible[idx];
    const copy: VariantDraft = {
      ...src,
      id: undefined,
      is_default: false,
      display_order: visible.length,
      name: src.name ? `${src.name} (copy)` : src.name,
      sku: "",
      barcode: "",
      images: [...src.images],
    };
    onChange([...variants, copy]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Product Variants</div>
          <div className="text-xs text-muted-foreground">
            Optional. Each variant has its own price, stock and images.
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Add Variant
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No variants. Base product price &amp; images will be used.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((v, i) => (
            <VariantCard
              key={v.id ?? `new-${i}`}
              index={i}
              value={v}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
              onDuplicate={() => duplicate(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantCard({
  index,
  value,
  onChange,
  onRemove,
  onDuplicate,
}: {
  index: number;
  value: VariantDraft;
  onChange: (patch: Partial<VariantDraft>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-secondary/30">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="p-1 rounded hover:bg-secondary"
          aria-label="Toggle variant"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 text-sm font-bold">
          Variant {index + 1}
          {value.size && <span className="ml-2 text-muted-foreground font-normal">· {value.size}</span>}
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onDuplicate} aria-label="Duplicate variant">
          <Copy className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove} aria-label="Delete variant">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>


      {open && (
        <div className="p-3 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Variant name (optional)">
              <Input value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Small pack" />
            </Field>
            <Field label="Size *">
              <Input value={value.size} onChange={(e) => onChange({ size: e.target.value })} placeholder="e.g. 500" />
            </Field>
            <Field label="Unit">
              <Input value={value.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="ml, g, pcs" />
            </Field>
            <Field label="Weight">
              <Input value={value.weight} onChange={(e) => onChange({ weight: e.target.value })} placeholder="e.g. 500g" />
            </Field>
            <Field label="SKU">
              <Input value={value.sku} onChange={(e) => onChange({ sku: e.target.value })} />
            </Field>
            <Field label="Barcode">
              <Input value={value.barcode} onChange={(e) => onChange({ barcode: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Field label="MRP ₹">
              <Input type="number" value={value.mrp} onChange={(e) => onChange({ mrp: Number(e.target.value) })} />
            </Field>
            <Field label="Selling ₹ *">
              <Input type="number" value={value.selling_price} onChange={(e) => onChange({ selling_price: Number(e.target.value) })} />
            </Field>
            <Field label="Retail ₹">
              <Input type="number" value={value.retail_price} onChange={(e) => onChange({ retail_price: Number(e.target.value) })} />
            </Field>
            <Field label="Stock *">
              <Input type="number" value={value.stock} onChange={(e) => onChange({ stock: Number(e.target.value) })} />
            </Field>
          </div>

          <MultiImageInput
            value={value.images}
            onChange={(images) => onChange({ images })}
            label="Variant images (1–6)"
            required
          />

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={value.is_available} onCheckedChange={(v) => onChange({ is_available: v })} />
              Available
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={value.is_default} onCheckedChange={(v) => onChange({ is_default: v })} />
              Default variant
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
