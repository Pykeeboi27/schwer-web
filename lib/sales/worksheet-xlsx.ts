import type { PurchaseOrderWorksheetData } from "@/lib/sales/worksheet";
import ExcelJS from "exceljs";
import path from "node:path";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "lib/sales/templates/sales-worksheet-template.xlsx",
);

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

/**
 * Fills the Sales Worksheet (FO-55) Excel template with a purchase order's
 * data and returns the resulting workbook as a buffer, ready to stream back
 * as a file download. Cell addresses match `SALES WORK SHEET FORM (2)` in
 * the original template workbook.
 */
export async function generatePurchaseOrderWorksheetXlsx(
  data: PurchaseOrderWorksheetData,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const sheet = workbook.worksheets[0];
  const quotationOrPoNumber = data.clientPoNumber || "QTN SERVED AS PO";

  sheet.getCell("I2").value = `SALES WORKSHEET No. ${data.poNumber}`;
  sheet.getCell("J3").value = data.salesPersonName;
  sheet.getCell("S3").value = formatDate(data.createdAt);

  sheet.getCell("C4").value = data.clientName;
  sheet.getCell("C5").value = data.clientAddress;
  sheet.getCell("C6").value = data.clientTin ?? "";

  sheet.getCell("J5").value = data.paymentTerms ?? "";
  sheet.getCell("J6").value = data.poAmount;

  sheet.getCell("J7").value = quotationOrPoNumber;
  sheet.getCell("N7").value = formatDate(data.poDate);
  sheet.getCell("R7").value = data.quotationNumber ?? "";

  sheet.getCell("C8").value = data.subject;
  sheet.getCell("J8").value = data.expectedCompletion
    ? formatDate(data.expectedCompletion)
    : data.leadTimeDays !== null
      ? `${data.leadTimeDays} day${data.leadTimeDays === 1 ? "" : "s"}`
      : "";

  sheet.getCell("C11").value = data.contactPersonName ?? "";
  sheet.getCell("C12").value = data.contactNumber ?? "";

  sheet.getCell("D16").value = data.notes ?? "";

  // Item rows: the template has 22 pre-formatted rows (20-41), each with
  // merged Description (D:L) / Qty (M:N) / Unit Cost (P:Q) / Line Cost (R:T)
  // cells, followed by a GRAND TOTAL row (42) and a "Prepared by" row (43).
  // Item rows show direct cost per line; the grand total is still the PO's
  // customer-facing selling amount, not the summed cost.
  const ITEM_START_ROW = 20;
  const ITEM_TEMPLATE_ROWS = 22;
  const items =
    data.items.length > 0
      ? data.items
      : [{ description: data.subject, quantity: 1, unitCost: null, lineTotal: 0 }];

  let totalRow = 42;
  let preparedByRow = 43;

  if (items.length > ITEM_TEMPLATE_ROWS) {
    const extraRows = items.length - ITEM_TEMPLATE_ROWS;
    sheet.duplicateRow(ITEM_START_ROW + ITEM_TEMPLATE_ROWS - 1, extraRows, true);
    totalRow += extraRows;
    preparedByRow += extraRows;
  }

  items.forEach((item, index) => {
    const row = ITEM_START_ROW + index;
    sheet.getCell(`D${row}`).value = item.description;
    sheet.getCell(`M${row}`).value = item.quantity;
    sheet.getCell(`P${row}`).value = item.unitCost ?? "";
    sheet.getCell(`R${row}`).value = item.lineTotal;
  });

  sheet.getCell(`R${totalRow}`).value = data.poAmount;
  sheet.getCell(`J${preparedByRow}`).value = data.salesPersonName;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
