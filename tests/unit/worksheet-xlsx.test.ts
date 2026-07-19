import type { PurchaseOrderWorksheetData } from "@/lib/sales/worksheet";
import { generatePurchaseOrderWorksheetXlsx } from "@/lib/sales/worksheet-xlsx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

const baseData: PurchaseOrderWorksheetData = {
  id: "po-1",
  poNumber: "PO-2026-001",
  clientPoNumber: "CLIENT-PO-42",
  quotationNumber: "QTN-2026-777",
  subject: "Supply and install fire pumps",
  poAmount: 1_250_000,
  marginPercent: 23.5,
  bankPercent: 5,
  sopPercent: 2.5,
  items: [
    { description: "Fire pump unit", quantity: 2, unitCost: 300_000, lineTotal: 600_000 },
    { description: "Control panel", quantity: 1, unitCost: 150_000, lineTotal: 150_000 },
  ],
  paymentTerms: "50% down, 50% on delivery",
  leadTimeDays: 45,
  poDate: "2026-06-01",
  expectedCompletion: null,
  notes: "Deliver to site B & coordinate with <engineering>",
  sector: "Construction",
  createdAt: "2026-05-15T00:00:00Z",
  salesPersonName: "Licebel Bernardo",
  clientName: "DATEM Incorporated",
  clientAddress: "BDO Tower, Makati, Metro Manila",
  clientTin: "123-456-789",
  contactPersonName: "Juan Dela Cruz",
  contactNumber: "0917-000-0000",
};

async function generateSheet(data: PurchaseOrderWorksheetData) {
  const buffer = await generatePurchaseOrderWorksheetXlsx(data);
  const zip = await JSZip.loadAsync(buffer);
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  return { zip, sheet };
}

describe("generatePurchaseOrderWorksheetXlsx", () => {
  it("preserves the checkbox form controls, drawings, image, and comments", async () => {
    const { zip } = await generateSheet(baseData);
    const names = Object.keys(zip.files);

    const ctrlProps = names.filter((n) => n.startsWith("xl/ctrlProps/ctrlProp"));
    expect(ctrlProps).toHaveLength(16);
    expect(names).toContain("xl/drawings/drawing1.xml");
    expect(names).toContain("xl/drawings/vmlDrawing1.vml");
    expect(names).toContain("xl/media/image1.png");
    expect(names).toContain("xl/comments1.xml");

    // The checkbox drawing must still carry the shapes, not just a logo stub.
    const drawing = await zip.file("xl/drawings/drawing1.xml")!.async("string");
    expect(drawing.length).toBeGreaterThan(10_000);
  });

  it("keeps the printed field labels intact", async () => {
    const { zip } = await generateSheet(baseData);
    const shared = await zip.file("xl/sharedStrings.xml")!.async("string");
    for (const label of [
      "Customer Name",
      "ATTACHMENTS:",
      "GRAND TOTAL :",
      "TOTAL AMOUNT",
      "REMARKS:",
      "Type of Sale",
      "Mode of Shipment",
    ]) {
      expect(shared).toContain(label);
    }
  });

  it("writes header fields into the correct cells", async () => {
    const { sheet } = await generateSheet(baseData);
    const cell = (addr: string) =>
      sheet.match(new RegExp(`<c r="${addr}"[^>]*>([\\s\\S]*?)</c>`))?.[1] ?? "";
    expect(sheet).toContain("SALES WORKSHEET No. PO-2026-001");
    // Customer info lands in the wide column C, not the cramped column B.
    expect(cell("C4")).toContain("DATEM Incorporated");
    expect(cell("C5")).toContain("BDO Tower, Makati, Metro Manila");
    expect(cell("C6")).toContain("123-456-789");
    expect(cell("C11")).toContain("Juan Dela Cruz");
    expect(cell("C12")).toContain("0917-000-0000");
    expect(cell("C15")).toContain("Construction");
    expect(cell("J3")).toContain("Licebel Bernardo");
    expect(cell("R7")).toContain("QTN-2026-777");
    expect(cell("J7")).toContain("CLIENT-PO-42");
  });

  it("escapes XML-unsafe characters in free text", async () => {
    const { sheet } = await generateSheet(baseData);
    expect(sheet).toContain(
      "Deliver to site B &amp; coordinate with &lt;engineering&gt;",
    );
    expect(sheet).not.toContain("<engineering>");
  });

  it("sets the grand total to the sum of line costs, not the PO amount", async () => {
    const { sheet } = await generateSheet(baseData);
    const cell = sheet.match(/<c r="R42"[^>]*>([\s\S]*?)<\/c>/);
    expect(cell?.[1]).toContain("<v>750000</v>"); // 600000 + 150000
    expect(cell?.[1]).not.toContain("1250000"); // not the selling amount
  });

  it("sets the Contract Amount to the total cost, not the selling amount", async () => {
    const { sheet } = await generateSheet(baseData);
    const cell = sheet.match(/<c r="J6"[^>]*>([\s\S]*?)<\/c>/);
    expect(cell?.[1]).toContain("<v>750000</v>"); // total cost
    expect(cell?.[1]).not.toContain("1250000"); // not the po_amount
  });

  it("stacks margin, bank, and SOP on the bottom rows of the REMARKS box", async () => {
    const { sheet } = await generateSheet(baseData);
    const cell = (addr: string) =>
      sheet.match(new RegExp(`<c r="${addr}"[^>]*>([\\s\\S]*?)</c>`))?.[1] ?? "";
    expect(cell("N50")).toContain("Margin: 23.50%");
    expect(cell("N51")).toContain("Bank: 5.00%");
    expect(cell("N52")).toContain("SOP: 2.50%"); // bottom-most line
  });

  it("anchors a single percentage to the box's bottom line", async () => {
    const { sheet } = await generateSheet({
      ...baseData,
      bankPercent: null,
      sopPercent: null,
    });
    const cell = (addr: string) =>
      sheet.match(new RegExp(`<c r="${addr}"[^>]*?(?:/>|>([\\s\\S]*?)</c>)`))?.[1] ?? "";
    expect(cell("N52")).toContain("Margin: 23.50%");
    expect(cell("N50")).not.toContain("Margin");
    expect(cell("N51")).not.toContain("Margin");
  });

  it("omits percentages that are not set on the PO", async () => {
    const { sheet } = await generateSheet({
      ...baseData,
      marginPercent: null,
      bankPercent: null,
      sopPercent: null,
    });
    const cell = (addr: string) =>
      sheet.match(new RegExp(`<c r="${addr}"[^>]*?(?:/>|>([\\s\\S]*?)</c>)`))?.[1] ?? "";
    for (const addr of ["N50", "N51", "N52"]) {
      expect(cell(addr)).not.toMatch(/Margin|Bank|SOP/);
    }
  });

  it("fills item rows with description, qty, unit cost, and line total", async () => {
    const { sheet } = await generateSheet(baseData);
    expect(sheet.match(/<c r="D20"[^>]*>([\s\S]*?)<\/c>/)?.[1]).toContain(
      "Fire pump unit",
    );
    expect(sheet.match(/<c r="M20"[^>]*>([\s\S]*?)<\/c>/)?.[1]).toContain("<v>2</v>");
    expect(sheet.match(/<c r="P20"[^>]*>([\s\S]*?)<\/c>/)?.[1]).toContain(
      "<v>300000</v>",
    );
    expect(sheet.match(/<c r="R20"[^>]*>([\s\S]*?)<\/c>/)?.[1]).toContain(
      "<v>600000</v>",
    );
    expect(sheet.match(/<c r="D21"[^>]*>([\s\S]*?)<\/c>/)?.[1]).toContain(
      "Control panel",
    );
  });

  it("notes overflow when a PO has more than 22 items but still totals them all", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      description: `Item ${i + 1}`,
      quantity: 1,
      unitCost: 100,
      lineTotal: 100,
    }));
    const { sheet } = await generateSheet({
      ...baseData,
      items: many,
      marginPercent: null,
    });
    expect(sheet.match(/<c r="R42"[^>]*>([\s\S]*?)<\/c>/)?.[1]).toContain("<v>2500</v>");
    expect(sheet.match(/<c r="N45"[^>]*>([\s\S]*?)<\/c>/)?.[1]).toContain(
      "3 additional item(s)",
    );
  });

  it("produces a valid, re-openable xlsx package", async () => {
    const buffer = await generatePurchaseOrderWorksheetXlsx(baseData);
    const zip = await JSZip.loadAsync(buffer);
    // Content types and workbook rels must survive untouched.
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    expect(zip.file("xl/workbook.xml")).not.toBeNull();
    expect(zip.file("xl/worksheets/_rels/sheet1.xml.rels")).not.toBeNull();
  });

  it("emits well-formed sheet XML that still wires the checkboxes", async () => {
    const { sheet } = await generateSheet(baseData);
    // jsdom's DOMParser flags malformed XML with a <parsererror> node.
    const doc = new DOMParser().parseFromString(sheet, "application/xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    // The 16 checkbox controls and legacy drawing link must survive our edits.
    expect((sheet.match(/<control shapeId=/g) ?? []).length).toBe(16);
    expect(sheet).toContain('<legacyDrawing r:id="rId3"/>');
  });
});
