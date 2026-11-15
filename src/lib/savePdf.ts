/**
 * Saves a generated PDF on every platform.
 *
 * - Browsers (desktop, Android Chrome, iOS Safari): normal file download.
 * - The Android app (Capacitor WebView): WebViews ignore blob/`<a download>` saves, so the PDF
 *   is written to the app cache and the system share sheet opens ("Save to Files", Drive,
 *   WhatsApp, Gmail, print, ...). The native plugins are loaded only inside the app.
 */
import type { jsPDF as JsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";

export async function savePdf(doc: JsPDF, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  // jsPDF's data URI is "data:application/pdf;filename=...;base64,<data>"; keep only the data.
  const base64 = doc.output("datauristring").split("base64,")[1];
  const written = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });
  try {
    await Share.share({
      title: filename,
      files: [written.uri],
      dialogTitle: "Save or share report",
    });
  } catch (e) {
    // Closing the share sheet rejects on some Android versions; that is not an error.
    const msg = String((e as Error)?.message ?? e);
    if (!/cancel|dismiss/i.test(msg)) throw e;
  }
}
