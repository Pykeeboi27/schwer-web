import { computeVatBreakdown } from "@/lib/sales/pricing";
import type { PurchaseOrderWorksheetData } from "@/lib/sales/worksheet";
import { formatCurrency } from "@/lib/utils/number-format";
import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "lib/sales/templates/sales-worksheet-template.xlsx",
);

const SHEET_PATH = "xl/worksheets/sheet1.xml";

// The printed form has 22 pre-formatted item rows (20-41). Rows are NOT
// duplicated at generation time: adding rows would require re-anchoring the
// checkbox form controls, merged ranges, and styles, which the surgical
// approach below deliberately leaves untouched. The grand total always sums
// every item, so it stays correct even if a PO has more than 22 lines.
const ITEM_START_ROW = 20;
const ITEM_ROW_COUNT = 22;
const GRAND_TOTAL_CELL = "R42";
const PREPARED_BY_CELL = "J43";
// The REMARKS box spans M45:T52 (label in M45). Percentages are stacked on its
// bottom rows in column N so the last value rests on the box's bottom line;
// an item-overflow note, when needed, goes at the top of the box.
const REMARKS_TOP_CELL = "N45";
const REMARKS_BOTTOM_ROW = 52;

function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Minimal, surgical writer over a worksheet's raw `sheet1.xml`.
 *
 * ExcelJS drops form-control checkboxes, legacy VML drawings, and embedded
 * comments on every read/write round-trip, which is exactly what stripped
 * those elements from earlier versions of the worksheet. To keep them intact
 * we never parse the workbook: we only rewrite the value of individual `<c>`
 * cells in place, preserving each cell's style (`s=`) and leaving every other
 * byte of the package untouched.
 *
 * Every cell we target already exists in the template grid, so this replaces
 * cells rather than inserting them; a missing target throws loudly so a
 * template change can't silently drop data.
 */
class SheetWriter {
  private xml: string;

  constructor(xml: string) {
    this.xml = xml;
  }

  private replaceCell(addr: string, build: (attrs: string) => string): void {
    const re = new RegExp(`<c r="${addr}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
    const match = this.xml.match(re);
    if (!match || match.index === undefined) {
      throw new Error(
        `Worksheet template is missing cell ${addr}; cannot fill the worksheet.`,
      );
    }
    // Keep the original style attribute (and any others), drop only the type.
    const attrs = (match[1] ?? "").replace(/\s+t="[^"]*"/g, "");
    this.xml =
      this.xml.slice(0, match.index) +
      build(attrs) +
      this.xml.slice(match.index + match[0].length);
  }

  setString(addr: string, value: string | null | undefined): void {
    const text = value == null ? "" : String(value);
    if (text === "") {
      this.replaceCell(addr, (attrs) => `<c r="${addr}"${attrs}/>`);
      return;
    }
    this.replaceCell(
      addr,
      (attrs) =>
        `<c r="${addr}"${attrs} t="inlineStr"><is><t xml:space="preserve">${escapeXml(
          text,
        )}</t></is></c>`,
    );
  }

  setNumber(addr: string, value: number | null | undefined): void {
    if (value == null || Number.isNaN(value)) {
      this.replaceCell(addr, (attrs) => `<c r="${addr}"${attrs}/>`);
      return;
    }
    this.replaceCell(addr, (attrs) => `<c r="${addr}"${attrs}><v>${value}</v></c>`);
  }

  toString(): string {
    return this.xml;
  }
}

/**
 * Fills the Sales Worksheet (FO-55) Excel template with a purchase order's
 * data and returns the resulting workbook as a buffer, ready to stream back
 * as a file download.
 *
 * Cell addresses match the original `SPMC-SALES-WORKSHEET` template (single
 * sheet, `sheet1.xml`). Values are written immediately to the right of / below
 * each printed label, matching the form layout. Type-of-Sale, Mode-of-Shipment,
 * Penalty, and Insurance checkboxes are intentionally left blank for the sales
 * engineer to tick by hand after download.
 */
export async function generatePurchaseOrderWorksheetXlsx(
  data: PurchaseOrderWorksheetData,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(await fs.readFile(TEMPLATE_PATH));
  const sheetFile = zip.file(SHEET_PATH);
  if (!sheetFile) {
    throw new Error(`Worksheet template is missing ${SHEET_PATH}.`);
  }

  const sheet = new SheetWriter(await sheetFile.async("string"));
  const quotationOrPoNumber = data.clientPoNumber || "QTN SERVED AS PO";

  // Item rows are totalled up front so the direct-cost total can also fill
  // the Contract Amount field. Each item's own selling_amount is already the
  // final VAT-inclusive price (VAT is resolved within cost and the margin
  // gross-up -- see computeSalesPricing), so it prints on the line and feeds
  // the grand total as-is, with nothing added on top.
  const items =
    data.items.length > 0
      ? data.items
      : [
          {
            description: data.subject,
            quantity: 1,
            unitCost: null,
            lineTotal: 0,
            sellingAmount: 0,
            marginAmount: 0,
            bankAmount: 0,
            sopAmount: 0,
            marginPercentage: null,
            bankPercentage: null,
            sopPercentage: null,
          },
        ];
  const totalCost = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemSelling = (item: (typeof items)[number]) =>
    item.sellingAmount ?? item.lineTotal;
  const totalSelling = items.reduce((sum, item) => sum + itemSelling(item), 0);

  // Title
  sheet.setString("I2", `SALES WORKSHEET No. ${data.poNumber}`);

  // Right-hand header column
  sheet.setString("J3", data.salesPersonName); // Sales Person
  sheet.setString("S3", formatDate(data.createdAt)); // Date
  sheet.setString("J5", data.paymentTerms ?? ""); // Payment Terms
  sheet.setNumber("J6", totalCost); // Contract Amount (total cost)
  sheet.setString("J7", quotationOrPoNumber); // Customer PO#
  sheet.setString("N7", formatDate(data.poDate)); // PO Date
  sheet.setString("R7", data.quotationNumber ?? ""); // Quotation #
  sheet.setString(
    "J8", // Leadtime / Target Completion Date
    data.expectedCompletion
      ? formatDate(data.expectedCompletion)
      : data.leadTimeDays !== null
        ? `${data.leadTimeDays} day${data.leadTimeDays === 1 ? "" : "s"}`
        : "",
  );

  // Left-hand header column. Column C is the wide input column; the labels
  // sit in the narrow column A, so values go in C (not the cramped column B).
  sheet.setString("C4", data.clientName); // Customer Name
  sheet.setString("C5", data.clientAddress); // Address
  sheet.setString("C6", data.clientTin ?? ""); // Tin Number
  sheet.setString("C8", data.subject); // Project Name
  sheet.setString("C11", data.contactPersonName ?? ""); // Contact Persons
  sheet.setString("C12", data.contactNumber ?? ""); // Contact Number
  sheet.setString("C15", data.sector ?? ""); // Market Segment
  sheet.setString("D16", data.notes ?? ""); // Special Instructions

  // Item rows (20-41). Columns: D=description, M=qty, P=unit cost,
  // R=VAT-inclusive selling price. The Item # (A), Item Code (B), and Unit
  // (O) columns have no source data and are left blank. The grand total is
  // the sum of every line's VAT-inclusive selling price (not just the 22
  // printed rows), so it stays correct even for POs with more items than fit.
  items.slice(0, ITEM_ROW_COUNT).forEach((item, index) => {
    const row = ITEM_START_ROW + index;
    sheet.setString(`D${row}`, item.description);
    sheet.setNumber(`M${row}`, item.quantity);
    sheet.setNumber(`P${row}`, item.unitCost);
    sheet.setNumber(`R${row}`, itemSelling(item));
  });

  sheet.setNumber(GRAND_TOTAL_CELL, totalSelling);
  sheet.setString(PREPARED_BY_CELL, data.salesPersonName);

  // REMARKS box (M45:T52): the distinct margin/bank/SOP percentages actually
  // used -- each with the items it applies to, NOT one blended/averaged
  // percentage -- plus the 12% VAT already embedded in each (decomposed for
  // BIR-style net/VAT reporting, not an additional charge), stacked on the
  // bottom rows (last line pushed lands on the bottom-most row), with any
  // item-overflow note at the top of the box.
  const vat = computeVatBreakdown({
    marginAmount: data.marginAmount ?? 0,
    bankAmount: data.bankAmount ?? 0,
    sopAmount: data.sopAmount ?? 0,
    // Unused here -- this box only needs the per-component VAT lines, not
    // the grand total (that's po_amount, printed separately).
    sellingAmount: 0,
  });

  // Grouped by the item's printed row number (matching column A's static
  // 1-22 labels on the template) rather than its description -- descriptions
  // can be long and repeat across margin/bank/SOP groups, cluttering the
  // small REMARKS box, whereas the row number is exactly what's already
  // printed beside each line so it reads as a direct cross-reference.
  const groupByPercentage = (
    getPercent: (item: (typeof items)[number]) => number | null,
  ): Array<{ percent: number; itemNumbers: number[] }> => {
    const groups = new Map<number, number[]>();
    items.forEach((item, index) => {
      const percent = getPercent(item);
      if (percent === null) return;
      const itemNumbers = groups.get(percent) ?? [];
      itemNumbers.push(index + 1);
      groups.set(percent, itemNumbers);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([percent, itemNumbers]) => ({ percent, itemNumbers }));
  };

  const remarksLines: string[] = [];
  for (const [label, groups] of [
    ["Margin", groupByPercentage((item) => item.marginPercentage)],
    ["Bank", groupByPercentage((item) => item.bankPercentage)],
    ["SOP", groupByPercentage((item) => item.sopPercentage)],
  ] as const) {
    for (const group of groups) {
      remarksLines.push(
        `${label} ${group.percent.toFixed(2)}%: ${group.itemNumbers.map((n) => `#${n}`).join(", ")}`,
      );
    }
  }
  if ((data.marginAmount ?? 0) > 0) {
    remarksLines.push(`Margin VAT (12%, incl.): ${formatCurrency(vat.marginVat)}`);
  }
  if ((data.bankAmount ?? 0) > 0) {
    remarksLines.push(`Bank VAT (12%, incl.): ${formatCurrency(vat.bankVat)}`);
  }
  if ((data.sopAmount ?? 0) > 0) {
    remarksLines.push(`SOP VAT (12%, incl.): ${formatCurrency(vat.sopVat)}`);
  }
  remarksLines.forEach((line, index) => {
    const row = REMARKS_BOTTOM_ROW - (remarksLines.length - 1 - index);
    sheet.setString(`N${row}`, line);
  });

  if (items.length > ITEM_ROW_COUNT) {
    sheet.setString(
      REMARKS_TOP_CELL,
      `${items.length - ITEM_ROW_COUNT} additional item(s) not shown`,
    );
  }

  zip.file(SHEET_PATH, sheet.toString());

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return buffer;
}
