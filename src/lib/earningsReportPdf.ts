/**
 * Admin earnings report as a designed A4 PDF (no screenshots): brand header, report period,
 * executive KPI summary and the shop breakdown, with page numbers. Built in the browser with
 * jsPDF + jspdf-autotable, which are loaded only when the report is generated.
 *
 * Amounts use "Rs." because the built-in PDF fonts have no rupee glyph.
 */
import type { jsPDF as JsPDF } from "jspdf";
import type { CellHookData } from "jspdf-autotable";
import { savePdf } from "@/lib/savePdf";
import apmartLogoUrl from "@/assets/apmart-logo-192.png";

export type EarningsShopRow = {
  name: string;
  owner: string;
  city: string;
  orders: number;
  grossRevenue: number;
  commission: number;
};

export type EarningsReportData = {
  generatedAt: Date;
  /** "This Year", "Last Month", or the dates for a custom range. */
  periodLabel: string;
  /** Explicit dates, e.g. "1 Nov 2026 – 15 Nov 2026". */
  periodDates: string;
  /** Platform commission as a fraction, e.g. 0.1. */
  commissionRate: number;
  kpis: {
    grossRevenue: number;
    shopEarnings: number;
    platformCommission: number;
    netRevenue: number;
    deliveryCharges: number;
    refunds: number;
    aov: number;
    totalOrders: number;
    completed: number;
    pending: number;
    cancelled: number;
    returned: number;
  };
  shops: EarningsShopRow[];
};

type RGB = [number, number, number];
const BRAND: RGB = [22, 128, 71];
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

export async function downloadEarningsReportPdf(data: EarningsReportData): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;
  const logo = await loadLogo();

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
    ensureSpace(120);
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
  doc.text("Earnings Report", W - PAGE_MARGIN, y + 10, { align: "right" });
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
  doc.text("Earnings & Platform Performance Report", PAGE_MARGIN + 8, y);
  y += 14;

  // ---------- Report period ----------
  const periodText =
    data.periodLabel === data.periodDates
      ? data.periodDates
      : `${data.periodLabel} (${data.periodDates})`;
  y += 2;

  sectionTitle("Report Period");
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
      ["Period:", { content: periodText, colSpan: 3 }],
      [
        "Orders in period:",
        int(data.kpis.totalOrders),
        "Commission rate:",
        `${Number((data.commissionRate * 100).toFixed(2))}%`,
      ],
    ],
  });
  y = lastY();

  // ---------- Executive KPI summary ----------
  sectionTitle("Executive Summary (INR)");
  const k = data.kpis;
  const cells: { label: string; value: string; color?: RGB }[] = [
    { label: "TOTAL PLATFORM REVENUE", value: money(k.grossRevenue), color: GOOD },
    { label: "SHOP EARNINGS", value: money(k.shopEarnings) },
    { label: "PLATFORM COMMISSION", value: money(k.platformCommission) },
    { label: "NET REVENUE", value: money(k.netRevenue), color: GOOD },
    { label: "DELIVERY CHARGES", value: money(k.deliveryCharges) },
    { label: "REFUNDS", value: money(k.refunds), color: k.refunds ? BAD : undefined },
    { label: "AVG ORDER VALUE", value: money(k.aov) },
    { label: "TOTAL ORDERS", value: int(k.totalOrders) },
    { label: "COMPLETED", value: int(k.completed), color: GOOD },
    { label: "PENDING", value: int(k.pending), color: k.pending ? WARN : undefined },
    { label: "CANCELLED", value: int(k.cancelled), color: k.cancelled ? BAD : undefined },
    { label: "RETURNED", value: int(k.returned) },
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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  y += 14;
  for (const line of [
    "Shop earnings and commission are calculated on delivered orders only.",
    "Net revenue is platform commission plus delivery charges.",
  ]) {
    ensureSpace(14);
    doc.text(line, PAGE_MARGIN + 8, y);
    y += 11;
  }

  // ---------- Shop breakdown ----------
  sectionTitle("Shop Breakdown");
  const R = (content: string) => ({ content, styles: { halign: "right" as const } });
  const shops = data.shops;
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 56 },
    rowPageBreak: "avoid",
    theme: "plain",
    headStyles: {
      fillColor: HEAD,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 8, bottom: 8, left: 8, right: 8 },
    },
    styles: {
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 7, bottom: 7, left: 8, right: 8 },
      lineColor: LINE,
      lineWidth: { bottom: 0.6 },
      valign: "middle",
    },
    alternateRowStyles: { fillColor: PANEL },
    head: [["Shop", "Owner", "City", R("Orders"), R("Gross Revenue"), R("Commission")]],
    body: shops.length
      ? shops.map((s) => [
          s.name,
          s.owner,
          s.city,
          int(s.orders),
          money(s.grossRevenue),
          money(s.commission),
        ])
      : [
          [
            {
              content: "No shops to show.",
              colSpan: 6,
              styles: { textColor: MUTED, halign: "center" },
            },
          ],
        ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 120 },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
      5: { halign: "right" },
    },
    didParseCell: (h: CellHookData) => {
      if (h.section === "body" && h.column.index === 4 && shops[h.row.index]?.grossRevenue > 0)
        h.cell.styles.textColor = GOOD;
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
    doc.text("AP Mart — Groceries from shops near you", PAGE_MARGIN, H - 22);
    doc.text(`Page ${p} of ${pages}`, W - PAGE_MARGIN, H - 22, { align: "right" });
  }

  await savePdf(doc, `ap-mart-earnings-report-${isoDate(data.generatedAt)}.pdf`);
}
