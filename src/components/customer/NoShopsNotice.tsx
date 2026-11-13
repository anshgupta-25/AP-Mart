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
      <div className="mx-auto max-w-sm rounded-xl border border-border/70 bg-card p-5 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-mint">
          <MapPin className="h-5 w-5 text-primary" strokeWidth={1.8} />
        </div>
        <h2 className="section-title mt-3">No shops deliver to this address yet</h2>
        <p className="mt-1.5 text-meta text-muted-foreground">
          Try another address, or check back soon as more local shops join.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            to="/customer/address-setup"
            className="press grid h-11 place-items-center rounded-xl bg-primary text-body font-semibold text-primary-foreground"
          >
            Change address
          </Link>
          <Button variant="secondary" className="h-11" onClick={() => onRefresh?.()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
