/**
 * "Not now" on the delivery-address prompt is remembered for the current app session only,
 * so the prompt comes back on the next launch until the customer saves an address.
 */
const key = (uid: string) => `ap.addressPrompt.dismissed.${uid}`;

export function isAddressPromptDismissed(uid: string | undefined) {
  if (!uid || typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(key(uid)) === "1";
  } catch {
    return false;
  }
}

export function dismissAddressPrompt(uid: string | undefined) {
  if (!uid || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key(uid), "1");
  } catch {
    // Storage unavailable (e.g. private mode): the prompt simply shows again next time.
  }
}
