/**
 * Inventory report as a real, designed PDF (no screenshots): brand header, shop profile,
 * summary grid, insights, expiry watch, best sellers, slow movers and the full inventory
 * ledger, with page numbers. Built in the browser with jsPDF + jspdf-autotable, which are
 * loaded only when a report is generated.
 *
 * Amounts use "Rs." because the built-in PDF fonts have no rupee glyph.
 */
import type { jsPDF as JsPDF } from "jspdf";
import type { CellHookData } from "jspdf-autotable";
import apmartLogoUrl from "@/assets/apmart-logo-192.png";

export type ReportProductRow = {
  name: string;
  category: string;
  unit: string;
  stock: number;
  initialStock: number;
  price: number;
  value: number;
  expiry: string | null;
  daysLeft: number | null;
  status: string;
  /** Stored image reference/URL (storage:// ref or http URL); optional. */
  image?: string | null;
};

export type ReportSalesRow = {
  name: string;
  orders: number;
  units: number;
  revenue: number;
  image?: string | null;
};

export type InventoryReportData = {
  shop: {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    phone?: string | null;
  };
  ownerEmail: string | null;
  generatedAt: Date;
  /** e.g. "Last 7 days" */
  periodLabel: string;
  /** Human-readable active filters for the inventory table, or null when unfiltered. */
  filtersLabel: string | null;
  summary: {
    total: number;
    totalStock: number;
    totalValue: number;
    low: number;
    out: number;
    expired: number;
    exp7: number;
  };
  sales: { orders: number; units: number; revenue: number };
  insights: string[];
  expiry: { label: string; rows: ReportProductRow[] }[];
  bestSelling: ReportSalesRow[];
  /** Products that sold the least in the period, including ones with no sales. */
  slowMoving: ReportSalesRow[];
  inventory: ReportProductRow[];
};

// Palette (RGB)
type RGB = [number, number, number];
const BRAND: RGB = [22, 128, 71]; // AP Mart green
const INK: RGB = [17, 24, 39];
const MUTED: RGB = [107, 114, 128];
const LINE: RGB = [229, 231, 235];
const PANEL: RGB = [248, 250, 252];
const PANEL_LINE: RGB = [226, 232, 240];
const HEAD: RGB = [15, 23, 42];
const GOOD: RGB = [16, 163, 104];
const WARN: RGB = [202, 138, 4];
const BAD: RGB = [220, 38, 38];

const PAGE_MARGIN = 40;

const money = (n: number) =>
  `Rs. ${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const int = (n: number) => Number(n || 0).toLocaleString("en-IN");
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stamp = (d: Date) => `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

function statusColor(status: string): RGB {
  if (status === "Expired" || status === "Out of Stock") return BAD;
  if (status === "Expiring Soon" || status === "Low Stock") return WARN;
  return GOOD;
}

function daysLeftText(d: number | null) {
  if (d === null) return "—";
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d === 0) return "Today";
  return `${d}d`;
}

/** The AP Mart logo as a PNG data URL, or null if it can't be loaded (header falls back to text). */
async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(apmartLogoUrl);
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")?.drawImage(bmp, 0, 0);
    bmp.close?.();
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- product photos */

const THUMB_PX = 120; // source thumbnail size (keeps the PDF small but sharp at ~30pt)
const THUMB_TIMEOUT_MS = 8000;

/** Fetches one image and returns a small square JPEG data URL, or null if it can't be loaded. */
async function loadThumbnail(raw: string): Promise<string | null> {
  try {
    const { resolveStorageUrl } = await import("@/lib/storage");
    const url = await resolveStorageUrl(raw);
    if (!url) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), THUMB_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      const bmp = await createImageBitmap(await res.blob());
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = THUMB_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff"; // JPEG has no transparency
      ctx.fillRect(0, 0, THUMB_PX, THUMB_PX);
      // Fit inside the square (contain), centred, so product shots are never cropped.
      const k = Math.min(THUMB_PX / bmp.width, THUMB_PX / bmp.height);
      const w = bmp.width * k;
      const h = bmp.height * k;
      ctx.drawImage(bmp, (THUMB_PX - w) / 2, (THUMB_PX - h) / 2, w, h);
      bmp.close?.();
      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null; // blocked by CORS, missing object, offline...: the report just shows a placeholder
  }
}

/** Loads every unique image once (a few at a time). Keys are the raw stored values. */
async function loadThumbnails(raws: (string | null | undefined)[]) {
  const unique = [...new Set(raws.filter((r): r is string => !!r))];
  const out = new Map<string, string>();
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const raw = unique[next++];
      const data = await loadThumbnail(raw);
      if (data) out.set(raw, data);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, unique.length) }, worker));
  return out;
}

export async function downloadInventoryReportPdf(data: InventoryReportData): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;

  // Photos for every product that appears anywhere in the report, plus the logo.
  const [logo, thumbs] = await Promise.all([
    loadLogo(),
    loadThumbnails([
      ...data.inventory.map((r) => r.image),
      ...data.bestSelling.map((r) => r.image),
      ...data.slowMoving.map((r) => r.image),
      ...data.expiry.flatMap((g) => g.rows.map((r) => r.image)),
    ]),
  ]);

  const doc: JsPDF = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const contentW = W - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  const lastY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 60) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  };

  const sectionTitle = (title: string) => {
    ensureSpace(60);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(title, PAGE_MARGIN + 8, y);
    y += 12;
  };

  // ---------- Header ----------
  const LOGO = 32;
  if (logo) {
    doc.addImage(logo, "PNG", PAGE_MARGIN, y - 2, LOGO, LOGO);
  } else {
    // Fallback if the logo image can't be loaded
    doc.setFillColor(...BRAND);
    doc.roundedRect(PAGE_MARGIN, y - 2, LOGO, LOGO, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("AP", PAGE_MARGIN + LOGO / 2, y + 18, { align: "center" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...INK);
  doc.text("AP Mart", PAGE_MARGIN + LOGO + 10, y + 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Inventory Report", W - PAGE_MARGIN, y + 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Generated: ${stamp(data.generatedAt)}`, W - PAGE_MARGIN, y + 22, { align: "right" });

  y += 38;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(2);
  doc.line(PAGE_MARGIN, y, W - PAGE_MARGIN, y);

  // ---------- Title ----------
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  const title = doc.splitTextToSize(`${data.shop.name}'s Inventory Report`, contentW - 8);
  doc.text(title, PAGE_MARGIN + 8, y);
  y += (title.length - 1) * 22 + 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Shop ID: ${data.shop.id}  •  Sales period: ${data.periodLabel}`, PAGE_MARGIN + 8, y);
  y += 8;

  // ---------- Shop profile ----------
  sectionTitle("Shop Profile");
  const address =
    [data.shop.address, data.shop.city, data.shop.state, data.shop.pincode]
      .filter(Boolean)
      .join(", ") || "Not provided";
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: "plain",
    styles: {
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 7, bottom: 7, left: 8, right: 8 },
      lineColor: LINE,
      lineWidth: { bottom: 0.6 },
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 92 },
      1: { cellWidth: contentW / 2 - 92 },
      2: { fontStyle: "bold", cellWidth: 92 },
    },
    body: [
      ["Shop Name:", data.shop.name, "Owner Email:", data.ownerEmail ?? "Not provided"],
      ["Phone:", data.shop.phone || "Not provided", "Products Listed:", int(data.summary.total)],
      ["Address:", address, "Report Period:", data.periodLabel],
    ],
  });
  y = lastY();

  // ---------- Summary grid ----------
  sectionTitle("Inventory Summary (INR)");
  const cells: { label: string; value: string; color?: RGB }[] = [
    { label: "TOTAL PRODUCTS", value: int(data.summary.total) },
    { label: "TOTAL STOCK (UNITS)", value: int(data.summary.totalStock) },
    { label: "INVENTORY VALUE", value: money(data.summary.totalValue), color: GOOD },
    {
      label: "LOW STOCK",
      value: int(data.summary.low),
      color: data.summary.low ? WARN : undefined,
    },
    {
      label: "OUT OF STOCK",
      value: int(data.summary.out),
      color: data.summary.out ? BAD : undefined,
    },
    {
      label: "EXPIRED",
      value: int(data.summary.expired),
      color: data.summary.expired ? BAD : undefined,
    },
    {
      label: "EXPIRING IN 7 DAYS",
      value: int(data.summary.exp7),
      color: data.summary.exp7 ? WARN : undefined,
    },
    { label: `UNITS SOLD (${data.periodLabel.toUpperCase()})`, value: int(data.sales.units) },
    { label: "SALES REVENUE", value: money(data.sales.revenue), color: GOOD },
  ];
  const cols = 3;
  const rowH = 46;
  const gridH = Math.ceil(cells.length / cols) * rowH + 8;
  ensureSpace(gridH + 10);
  doc.setFillColor(...PANEL);
  doc.setDrawColor(...PANEL_LINE);
  doc.setLineWidth(0.8);
  doc.rect(PAGE_MARGIN, y, contentW, gridH, "FD");
  const colW = contentW / cols;
  cells.forEach((c, i) => {
    const cx = PAGE_MARGIN + 16 + (i % cols) * colW;
    const cy = y + 18 + Math.floor(i / cols) * rowH;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(c.label, cx, cy);
    doc.setFontSize(14);
    doc.setTextColor(...(c.color ?? INK));
    doc.text(c.value, cx, cy + 19);
  });
  y += gridH;

  // ---------- Insights ----------
  sectionTitle("Insights");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  for (const line of data.insights) {
    const wrapped = doc.splitTextToSize(line, contentW - 30);
    ensureSpace(wrapped.length * 13 + 8);
    y += 6;
    doc.setFillColor(...BRAND);
    doc.circle(PAGE_MARGIN + 12, y + 3.5, 2.2, "F");
    doc.setTextColor(...INK);
    doc.text(wrapped, PAGE_MARGIN + 22, y + 7);
    y += wrapped.length * 13 + 2;
  }

  // ---------- Shared table styling ----------
  const tableBase = {
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 56 },
    // Never split a row (and its photo) across two pages.
    rowPageBreak: "avoid" as const,
    theme: "plain" as const,
    headStyles: {
      fillColor: HEAD,
      textColor: [255, 255, 255] as RGB,
      fontStyle: "bold" as const,
      fontSize: 9,
      cellPadding: { top: 8, bottom: 8, left: 8, right: 8 },
    },
    styles: {
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 7, bottom: 7, left: 8, right: 8 },
      lineColor: LINE,
      lineWidth: { bottom: 0.6 },
      valign: "middle" as const,
    },
    alternateRowStyles: { fillColor: PANEL },
  };

  const THUMB = 30;
  const THUMB_PAD = THUMB + 18; // left padding that leaves room for the photo

  /** Makes room for the photo in a product cell. */
  const photoCellStyle = (h: CellHookData) => {
    h.cell.styles.cellPadding = { top: 5, bottom: 5, left: THUMB_PAD, right: 8 };
    h.cell.styles.minCellHeight = THUMB + 10;
  };

  /** Draws the product photo (or a quiet placeholder) at the left of a product cell. */
  const drawPhoto = (h: CellHookData, raw: string | null | undefined) => {
    const x = h.cell.x + 8;
    const yy = h.cell.y + (h.cell.height - THUMB) / 2;
    const img = raw ? thumbs.get(raw) : undefined;
    if (img) {
      doc.addImage(img, "JPEG", x, yy, THUMB, THUMB);
    } else {
      doc.setFillColor(...PANEL);
      doc.rect(x, yy, THUMB, THUMB, "F");
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.6);
      // simple "box" glyph so a missing photo reads as intentional
      doc.rect(x + 9, yy + 9, THUMB - 18, THUMB - 18, "S");
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.6);
    doc.rect(x, yy, THUMB, THUMB, "S");
  };

  /** Draws a small grey "category • unit" line under the bold product name (column 0). */
  const productSubLine = (subFor: (rowIndex: number) => string) => (h: CellHookData) => {
    if (h.section !== "body" || h.column.index !== 0) return;
    const sub = subFor(h.row.index);
    if (!sub) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      sub,
      h.cell.x + h.cell.padding("left"),
      h.cell.y + h.cell.height - h.cell.padding("bottom") - 1.5,
    );
  };

  const R = (content: string) => ({ content, styles: { halign: "right" as const } });

  const emptyRow = (cols: number, text: string) => [
    [{ content: text, colSpan: cols, styles: { textColor: MUTED, halign: "center" as const } }],
  ];

  // ---------- Expiry watch ----------
  sectionTitle("Expiry Watch");
  const expiryRows = data.expiry.flatMap((g) => g.rows.map((r) => ({ ...r, group: g.label })));
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [["Product", "Window", R("Stock"), R("Expiry Date"), R("Days Left")]],
    body: expiryRows.length
      ? expiryRows.map((r) => [
          r.name,
          r.group,
          int(r.stock),
          r.expiry ?? "—",
          daysLeftText(r.daysLeft),
        ])
      : emptyRow(5, "No products are expired or expiring in the next 30 days."),
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
    },
    didDrawCell: expiryRows.length
      ? (h: CellHookData) => {
          if (h.section !== "body" || h.column.index !== 0) return;
          drawPhoto(h, expiryRows[h.row.index]?.image);
          productSubLine((i) =>
            [expiryRows[i]?.category, expiryRows[i]?.unit].filter(Boolean).join(" • "),
          )(h);
        }
      : undefined,
    didParseCell: (h: CellHookData) => {
      if (!expiryRows.length) return;
      if (h.section === "body" && h.column.index === 0) {
        h.cell.styles.fontStyle = "bold";
        h.cell.text = [...h.cell.text, " "];
        photoCellStyle(h);
      }
      if (h.section === "body" && h.column.index === 4) {
        const d = expiryRows[h.row.index]?.daysLeft;
        h.cell.styles.textColor = d !== null && d !== undefined && d < 0 ? BAD : WARN;
      }
    },
  });
  y = lastY();

  // ---------- Sales tables ----------
  const salesTable = (title: string, rows: ReportSalesRow[], empty: string) => {
    sectionTitle(title);
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [["#", "Product", R("Orders"), R("Units Sold"), R("Revenue")]],
      body: rows.length
        ? rows.map((r, i) => [String(i + 1), r.name, int(r.orders), int(r.units), money(r.revenue)])
        : emptyRow(5, empty),
      columnStyles: {
        0: { cellWidth: 26, textColor: MUTED },
        1: { fontStyle: "bold" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: (h: CellHookData) => {
        if (!rows.length || h.section !== "body") return;
        if (h.column.index === 1) photoCellStyle(h);
        if (h.column.index === 4 && rows[h.row.index]?.revenue > 0) h.cell.styles.textColor = GOOD;
      },
      didDrawCell: rows.length
        ? (h: CellHookData) => {
            if (h.section === "body" && h.column.index === 1)
              drawPhoto(h, rows[h.row.index]?.image);
          }
        : undefined,
    });
    y = lastY();
  };
  salesTable(
    `Best Sellers (${data.periodLabel})`,
    data.bestSelling,
    "No delivered orders in this period.",
  );
  salesTable(
    `Least Sold Products (${data.periodLabel})`,
    data.slowMoving,
    "No sales recorded in this period.",
  );

  // ---------- Full inventory ledger ----------
  sectionTitle("Inventory Ledger");
  if (data.filtersLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(`Filters applied: ${data.filtersLabel}`, PAGE_MARGIN + 8, y + 2);
    y += 10;
  }
  const inv = data.inventory;
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [["Product", R("Stock"), R("Price"), R("Value"), R("Expiry"), R("Status")]],
    body: inv.length
      ? inv.map((r) => [
          r.name,
          `${int(r.stock)} / ${int(r.initialStock)}`,
          money(r.price),
          money(r.value),
          r.expiry ?? "—",
          r.status,
        ])
      : emptyRow(6, "No products match the current filters."),
    columnStyles: {
      0: { cellWidth: 190 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    didDrawCell: inv.length
      ? (h: CellHookData) => {
          if (h.section !== "body" || h.column.index !== 0) return;
          drawPhoto(h, inv[h.row.index]?.image);
          productSubLine((i) => [inv[i]?.category, inv[i]?.unit].filter(Boolean).join(" • "))(h);
        }
      : undefined,
    didParseCell: (h: CellHookData) => {
      if (!inv.length || h.section !== "body") return;
      if (h.column.index === 0) {
        h.cell.styles.fontStyle = "bold";
        h.cell.text = [...h.cell.text, " "];
        photoCellStyle(h);
      }
      if (h.column.index === 5) h.cell.styles.textColor = statusColor(inv[h.row.index]?.status);
    },
  });

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.6);
    doc.line(PAGE_MARGIN, H - 36, W - PAGE_MARGIN, H - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("AP Mart Inventory Report — Local shops, delivered.", PAGE_MARGIN, H - 22);
    doc.text(`Page ${p} of ${pages}`, W - PAGE_MARGIN, H - 22, { align: "right" });
  }

  const safeName = data.shop.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "shop";
  doc.save(`ap-mart-inventory-report-${safeName}-${isoDate(data.generatedAt)}.pdf`);
}
