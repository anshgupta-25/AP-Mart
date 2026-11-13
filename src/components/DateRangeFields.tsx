import { Input } from "@/components/ui/input";
import { expiryStatus, shelfLifeDays } from "@/lib/expiry";

export function dateRangeError(mfg: string, exp: string): string | null {
  if (!mfg || !exp) return null;
  const m = new Date(mfg);
  const e = new Date(exp);
  if (isNaN(m.getTime()) || isNaN(e.getTime())) return null;
  if (e.getTime() <= m.getTime()) return "Expiry date must be later than the manufacturing date.";
  return null;
}

export function DateRangeFields({
  mfg, exp, onMfg, onExp,
}: { mfg: string; exp: string; onMfg: (v: string) => void; onExp: (v: string) => void }) {
  const st = expiryStatus(exp, mfg);
  const shelf = shelfLifeDays(mfg, exp);
  const err = dateRangeError(mfg, exp);

  return (
    <div className="space-y-2 border-t border-border/70 pt-3">
      <div className="text-small font-medium text-muted-foreground">Manufacturing &amp; Expiry (optional)</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-small font-medium">Mfg date</label>
          <Input type="date" value={mfg} onChange={(e) => onMfg(e.target.value)} max={exp || undefined} />
        </div>
        <div>
          <label className="mb-1 block text-small font-medium">Expiry date</label>
          <Input type="date" value={exp} onChange={(e) => onExp(e.target.value)} min={mfg || undefined} />
        </div>
      </div>

      {err ? (
        <p className="text-caption font-medium text-destructive">{err}</p>
      ) : (
        (shelf !== null || st.status !== "none") && (
          <div className="flex flex-wrap gap-2 text-caption">
            {shelf !== null && (
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                Shelf life: {shelf} Day{shelf === 1 ? "" : "s"}
              </span>
            )}
            {st.status !== "none" && (
              <span className={`rounded-full border px-2 py-0.5 font-medium ${st.color}`}>
                Status: {st.statusLabel}
              </span>
            )}
          </div>
        )
      )}
      <p className="text-micro text-muted-foreground">
        Values are calculated automatically from the dates you pick.
      </p>
    </div>
  );
}
