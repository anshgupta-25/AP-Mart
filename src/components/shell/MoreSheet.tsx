import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isNavActive, type NavGroup } from "@/lib/nav/types";

export function MoreSheet({
  open,
  onOpenChange,
  groups,
  pathname,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: NavGroup[];
  pathname: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[82dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
        <SheetHeader className="mb-2 text-left">
          <SheetTitle className="text-subtitle">More</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.label}>
              {g.label && <div className="eyebrow mb-1.5 px-1">{g.label}</div>}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {g.items.map((i) => {
                  const Icon = i.icon;
                  const active = isNavActive(pathname, i.to);
                  const [path, qs] = i.to.split("?");
                  const search = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
                  return (
                    <Link
                      key={i.to}
                      to={path as any}
                      search={search as any}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "press flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center",
                        active ? "bg-primary-soft text-primary-ink" : "bg-secondary/60",
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                      <span className="text-small font-medium leading-tight">{i.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
