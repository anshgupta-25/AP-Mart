import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { ChevronRight, Crosshair, MapPin, PencilLine } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { dismissAddressPrompt, isAddressPromptDismissed } from "@/lib/addressPrompt";

/**
 * Customers browse first and are asked for a delivery address in a sheet, instead of being
 * forced onto the address page before they can see anything. "Not now" hides the sheet for
 * the rest of this app session; it comes back on the next launch until an address is saved.
 * Checkout still requires an address.
 */
function useNeedsAddress() {
  const { user } = useAuth();
  const { hasAddress, ready } = useDeliveryContext();
  return { user, needsAddress: !!user && ready && !hasAddress };
}

export function AddressPromptSheet() {
  const { user, needsAddress } = useNeedsAddress();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dismissed, setDismissed] = useState(() => isAddressPromptDismissed(user?.id));

  const close = useCallback(() => {
    dismissAddressPrompt(user?.id);
    setDismissed(true);
  }, [user?.id]);

  const go = (how: "locate" | "form") =>
    navigate({
      to: "/customer/address-setup",
      search: { next: pathname, start: how } as never,
    });

  const open = needsAddress && !dismissed && !isAddressPromptDismissed(user?.id);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-[22px] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6"
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border" aria-hidden />
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-mint text-primary-ink">
            <MapPin className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <SheetTitle className="mt-3 text-[18px] font-semibold tracking-[-0.02em]">
            Where should we deliver?
          </SheetTitle>
          <SheetDescription className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">
            Add your address to see which shops near you can deliver.
          </SheetDescription>
        </div>

        <div className="mt-5 space-y-2.5">
          <Button className="h-11 w-full gap-2 rounded-xl" onClick={() => go("locate")}>
            <Crosshair className="h-4 w-4" /> Use current location
          </Button>
          <Button
            variant="secondary"
            className="h-11 w-full gap-2 rounded-xl"
            onClick={() => go("form")}
          >
            <PencilLine className="h-4 w-4" /> Enter address manually
          </Button>
          <button
            type="button"
            onClick={close}
            className="press block w-full py-2 text-center text-[13px] font-medium text-muted-foreground"
          >
            Not now
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Slim reminder on the storefront while no address is saved (also after "Not now"). */
export function AddressBanner() {
  const { needsAddress } = useNeedsAddress();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!needsAddress) return null;
  return (
    <div className="px-4">
      <button
        type="button"
        onClick={() =>
          navigate({ to: "/customer/address-setup", search: { next: pathname } as never })
        }
        className="press flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary-soft px-3.5 py-3 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-primary-ink">
          <MapPin className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-primary-ink">
            Add your delivery address
          </span>
          <span className="block text-[12px] text-primary-ink/75">
            See which shops near you can deliver
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-primary-ink/60" />
      </button>
    </div>
  );
}
