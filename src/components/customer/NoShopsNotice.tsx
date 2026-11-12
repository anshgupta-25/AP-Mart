import { Link } from "@tanstack/react-router";
import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when the customer has a saved address but no shop currently
 * delivers there. Replaces misleading "order something first" empties.
 */
export function NoShopsNotice({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-card">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10">
          <MapPin className="h-8 w-8 text-primary" strokeWidth={1.75} />
        </div>
        <h2 className="font-display text-lg font-extrabold mt-4">
          No shops currently deliver to your location.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We're expanding fast — try another address or check again in a moment.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            to="/customer/address-setup"
            className="rounded-2xl gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground"
          >
            Change Address
          </Link>
          <Button variant="outline" className="rounded-2xl" onClick={() => onRefresh?.()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
