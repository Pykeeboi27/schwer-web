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

  // Item row 1: the PO subject/amount, matching the previous HTML worksheet's
  // single auto-filled line (qty 1, unit "assy" are static in the template).
  sheet.getCell("D20").value = data.subject;
  sheet.getCell("P20").value = data.poAmount;
  sheet.getCell("R20").value = data.poAmount;

  sheet.getCell("R42").value = data.poAmount;
  sheet.getCell("J43").value = data.salesPersonName;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
