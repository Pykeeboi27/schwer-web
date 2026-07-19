import type { PurchaseOrderWorksheetData } from "@/lib/sales/worksheet";
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

  // Item rows are totalled up front so the cost total can also fill the
  // Contract Amount field (the form treats both as the total direct cost;
  // margin/bank/SOP are surfaced only as percentages in REMARKS).
  const items =
    data.items.length > 0
      ? data.items
      : [{ description: data.subject, quantity: 1, unitCost: null, lineTotal: 0 }];
  const totalCost = items.reduce((sum, item) => sum + item.lineTotal, 0);

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

  // Item rows (20-41). Columns: D=description, M=qty, P=unit cost, R=line cost.
  // The Item # (A), Item Code (B), and Unit (O) columns have no source data
  // and are left blank. The grand total is the sum of every line's cost.
  items.slice(0, ITEM_ROW_COUNT).forEach((item, index) => {
    const row = ITEM_START_ROW + index;
    sheet.setString(`D${row}`, item.description);
    sheet.setNumber(`M${row}`, item.quantity);
    sheet.setNumber(`P${row}`, item.unitCost);
    sheet.setNumber(`R${row}`, item.lineTotal);
  });

  sheet.setNumber(GRAND_TOTAL_CELL, totalCost);
  sheet.setString(PREPARED_BY_CELL, data.salesPersonName);

  // REMARKS box (M45:T52): margin, bank, and SOP percentages stacked on the
  // bottom rows (SOP on the bottom-most line), with any item-overflow note at
  // the top of the box.
  const percentLines: string[] = [];
  if (data.marginPercent !== null) {
    percentLines.push(`Margin: ${data.marginPercent.toFixed(2)}%`);
  }
  if (data.bankPercent !== null) {
    percentLines.push(`Bank: ${data.bankPercent.toFixed(2)}%`);
  }
  if (data.sopPercent !== null) {
    percentLines.push(`SOP: ${data.sopPercent.toFixed(2)}%`);
  }
  percentLines.forEach((line, index) => {
    const row = REMARKS_BOTTOM_ROW - (percentLines.length - 1 - index);
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
