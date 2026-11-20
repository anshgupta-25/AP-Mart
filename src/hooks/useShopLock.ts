import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";

// "Send all to shop": when on, checkout sources every cart item from the cart's
// selected shop instead of letting the planner split the order across shops.
// Stored per user in this browser; read by the cart card and by checkout.

const KEY_PREFIX = "apmart.cart.sendAllToShop:";
const EVENT = "apmart:shop-lock-change";

function read(userId: string | undefined): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY_PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(KEY_PREFIX)) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage); // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useShopLock() {
  const { user } = useAuth();
  const userId = user?.id;
  const locked = useSyncExternalStore(
    subscribe,
    () => read(userId),
    () => false,
  );

  const setLocked = useCallback(
    (next: boolean) => {
      if (!userId) return;
      try {
        if (next) localStorage.setItem(KEY_PREFIX + userId, "1");
        else localStorage.removeItem(KEY_PREFIX + userId);
      } catch {
        // Storage unavailable (private mode): the toggle just won't persist.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [userId],
  );

  return { locked, setLocked };
}
