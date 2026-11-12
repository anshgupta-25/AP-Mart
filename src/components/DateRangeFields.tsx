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
    <div className="pt-2 border-t border-border space-y-2">
      <div className="text-xs font-bold text-muted-foreground">Manufacturing &amp; Expiry (optional)</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold flex items-center gap-1">📅 Mfg date</label>
          <Input type="date" value={mfg} onChange={(e) => onMfg(e.target.value)} max={exp || undefined} />
        </div>
        <div>
          <label className="text-xs font-bold flex items-center gap-1">📅 Expiry date</label>
          <Input type="date" value={exp} onChange={(e) => onExp(e.target.value)} min={mfg || undefined} />
        </div>
      </div>

      {err ? (
        <p className="text-[11px] font-semibold text-destructive">{err}</p>
      ) : (
        (shelf !== null || st.status !== "none") && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {shelf !== null && (
              <span className="px-2 py-0.5 rounded-full bg-secondary font-semibold">
                Shelf life: {shelf} Day{shelf === 1 ? "" : "s"}
              </span>
            )}
            {st.status !== "none" && (
              <span className={`px-2 py-0.5 rounded-full border font-semibold ${st.color}`}>
                {st.emoji} Status: {st.statusLabel}
              </span>
            )}
          </div>
        )
      )}
      <p className="text-[10px] text-muted-foreground">
        Values are calculated automatically from the dates you pick.
      </p>
    </div>
  );
}
