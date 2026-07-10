import type { PurchaseOrderWorksheetData } from "@/lib/sales/worksheet";
import { formatCurrency } from "@/lib/utils/number-format";

type SalesWorksheetProps = {
  data: PurchaseOrderWorksheetData;
};

const BLANK_ITEM_ROWS = 15;

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 border border-black px-2 py-1 text-xs ${className}`}>
      <span className="shrink-0 font-semibold uppercase text-neutral-700">{label}:</span>
      <span className="truncate">{value ?? "—"}</span>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-6 border border-black p-2 text-xs">
      <span className="font-semibold uppercase text-neutral-700">{label}:</span>
      <span className="border-t border-black" />
    </div>
  );
}

export function SalesWorksheet({ data }: SalesWorksheetProps) {
  return (
    <div className="border border-black text-black">
      {/* Header */}
      <div className="border-b border-black p-3 text-center">
        <h1 className="text-lg font-bold tracking-wide">SALES WORKSHEET</h1>
      </div>
      <div className="grid grid-cols-2">
        <Field label="Sales Worksheet No." value={data.poNumber} />
        <Field label="Date" value={formatDate(data.createdAt)} />
        <Field label="Sales Person" value={data.salesPersonName || "—"} />
        <Field label="Market Segment" value={data.sector ?? "—"} />
      </div>

      {/* Customer block */}
      <div className="grid grid-cols-2">
        <Field label="Customer Name" value={data.clientName} />
        <Field label="TIN Number" value={data.clientTin ?? "—"} />
      </div>
      <Field label="Address" value={data.clientAddress || "—"} />
      <div className="grid grid-cols-2">
        <Field label="Contact Person" value={data.contactPersonName ?? "—"} />
        <Field label="Contact Number" value={data.contactNumber ?? "—"} />
      </div>
      <Field label="Deliver / Ship to" value="—" />

      {/* Sale details */}
      <Field
        label="Type of Sale"
        value="Goods ☐   Loose Supply ☐   Installation ☐   Others ☐"
      />
      <div className="grid grid-cols-2">
        <Field label="Payment Terms" value={data.paymentTerms ?? "—"} />
        <Field label="Contract Amount" value={formatCurrency(data.poAmount)} />
      </div>
      <div className="grid grid-cols-2">
        <Field label="Customer PO #" value={data.clientPoNumber ?? "QTN SERVED AS PO"} />
        <Field label="PO Date" value={formatDate(data.poDate)} />
      </div>
      <div className="grid grid-cols-2">
        <Field label="Quotation #" value={data.quotationNumber ?? "—"} />
        <Field
          label="Leadtime / Target Completion"
          value={
            data.expectedCompletion
              ? formatDate(data.expectedCompletion)
              : data.leadTimeDays !== null
                ? `${data.leadTimeDays} day${data.leadTimeDays === 1 ? "" : "s"}`
                : "—"
          }
        />
      </div>
      <Field label="Project Name" value={data.subject} />
      <div className="grid grid-cols-2">
        <Field label="Penalty Clause" value="—  (Y / N)" />
        <Field label="Insurance Required" value="—  (Y / N)" />
      </div>
      <Field label="Special Instructions" value={data.notes ?? "—"} />

      {/* Item table */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-black p-1">Item</th>
            <th className="border border-black p-1">Item Code</th>
            <th className="border border-black p-1">Description</th>
            <th className="border border-black p-1">Qty</th>
            <th className="border border-black p-1">Unit</th>
            <th className="border border-black p-1">Unit Price</th>
            <th className="border border-black p-1">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-1 text-center">1</td>
            <td className="border border-black p-1">&nbsp;</td>
            <td className="border border-black p-1">{data.subject}</td>
            <td className="border border-black p-1 text-center">1</td>
            <td className="border border-black p-1 text-center">assy</td>
            <td className="border border-black p-1 text-right">
              {formatCurrency(data.poAmount)}
            </td>
            <td className="border border-black p-1 text-right">
              {formatCurrency(data.poAmount)}
            </td>
          </tr>
          {Array.from({ length: BLANK_ITEM_ROWS }, (_, index) => (
            <tr key={index}>
              <td className="border border-black p-1 text-center">{index + 2}</td>
              <td className="border border-black p-1">&nbsp;</td>
              <td className="border border-black p-1">&nbsp;</td>
              <td className="border border-black p-1">&nbsp;</td>
              <td className="border border-black p-1">&nbsp;</td>
              <td className="border border-black p-1">&nbsp;</td>
              <td className="border border-black p-1">&nbsp;</td>
            </tr>
          ))}
          <tr>
            <td className="border border-black p-1 text-right font-semibold" colSpan={6}>
              GRAND TOTAL
            </td>
            <td className="border border-black p-1 text-right font-semibold">
              {formatCurrency(data.poAmount)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Signatures */}
      <div className="grid grid-cols-2">
        <SignatureLine label="Prepared by (SE)" />
        <SignatureLine label="Checked by (SM)" />
        <SignatureLine label="Checked by (JRC)" />
        <SignatureLine label="Noted by (ACCTG)" />
        <SignatureLine label="Noted by (ENGG)" />
        <SignatureLine label="Approved by (JGV)" />
      </div>

      <div className="border-t border-black p-2 text-right text-[10px] text-neutral-500">
        FO-55
      </div>
    </div>
  );
}
