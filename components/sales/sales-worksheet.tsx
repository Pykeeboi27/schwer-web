import type { PurchaseOrderWorksheetData } from "@/lib/sales/worksheet";
import { formatCurrency } from "@/lib/utils/number-format";
import type { ReactNode } from "react";

type SalesWorksheetProps = {
  data: PurchaseOrderWorksheetData;
};

const BLANK_ITEM_ROWS = 21;

/** Excel-style entry colors, matched to the reference filled-in worksheet. */
const BLUE_VALUE = "text-[#1F4E79]";
const MAROON_VALUE = "text-[#953735]";
const BAND_BG = "bg-[#DCE6F1]";

const ATTACHMENT_ITEMS = [
  "PURCHASE ORDER (MTP / NOA) S.E",
  "QUOTATION (TO END CUSTOMER) S.E",
  "APPROVED DRAWING (ENGINEERING)",
  "PURCHASE REQUEST SHEET (ENGINEERING)",
  "PURCHASE ORDERS (PURCHASING)",
  "DELIVERY RECEIPTS (COORDINATOR)",
  "SALES INVOICES (ACCOUNTING)",
];

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

/** A label followed by a value on a single ruled (bottom-border) line, like a fill-in form field. */
function Field({
  label,
  value,
  className = "",
  valueClassName = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={`flex items-baseline gap-1.5 border-b border-black px-1 py-0.5 ${className}`}
    >
      <span className="shrink-0 font-semibold text-neutral-800">{label}:</span>
      <span className={`flex-1 truncate ${valueClassName}`}>{value || " "}</span>
    </div>
  );
}

function Checkbox({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className="inline-block h-2 w-2 shrink-0 border border-black" />
      {label}
    </span>
  );
}

/** A row of hand-checkable options, e.g. "Type of Sale: [ ] GOODS [ ] LOOSE SUPPLY ...". */
function CheckboxRow({
  label,
  options,
  className = "",
}: {
  label: string;
  options: string[];
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-black px-1 py-0.5 ${className}`}
    >
      {label ? (
        <span className="shrink-0 font-semibold text-neutral-800">{label}:</span>
      ) : null}
      {options.map((option) => (
        <Checkbox key={option} label={option} />
      ))}
    </div>
  );
}

/** A yes/no field followed by a blank ruled detail line, e.g. Penalty Clause / Insurance. */
function YesNoDetailField({
  label,
  detailLabel,
}: {
  label: string;
  detailLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5 border-b border-black px-1 py-0.5">
      <span className="shrink-0 font-semibold text-neutral-800">{label}:</span>
      <span className="inline-block w-5 border-b border-black">&nbsp;</span>
      <span className="shrink-0 text-neutral-500">(Y / N)</span>
      <span className="shrink-0 font-semibold text-neutral-800">{detailLabel}</span>
      <span className="flex-1 border-b border-black">&nbsp;</span>
    </div>
  );
}

function SignatureLine({ label, value = "" }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 px-1 py-1.5">
      <span className="w-24 shrink-0 font-semibold text-neutral-800">{label}:</span>
      <span className="flex-1 truncate border-b border-black">{value || " "}</span>
    </div>
  );
}

export function SalesWorksheet({ data }: SalesWorksheetProps) {
  const quotationOrPoNumber = data.clientPoNumber || "QTN SERVED AS PO";

  return (
    <div className="border-2 border-black text-[9px] leading-tight text-black">
      {/* Header band: logo left, worksheet no. / sales person / date right */}
      <div className="grid grid-cols-[34%_66%] border-b border-black">
        <div className="flex items-center justify-center border-r border-black p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sales-worksheet-logo.png"
            alt="Schwer Power Manufacturing Corp"
            className="h-8"
          />
        </div>
        <div className="flex flex-col justify-center gap-1 px-2 py-1">
          <div className="text-xs font-bold">
            SALES WORKSHEET No. <span className="font-medium">{data.poNumber}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 font-semibold text-neutral-800">Sales Person</span>
            <span className="font-bold">{data.salesPersonName}</span>
            <span className="ml-auto flex shrink-0 items-baseline gap-1.5">
              <span className="font-semibold text-neutral-800">Date:</span>
              <span>{formatDate(data.createdAt)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Upper block: two columns side by side */}
      <div className="grid grid-cols-[34%_66%] border-b border-black">
        {/* Left column: customer info (entered values in blue, matching the reference) */}
        <div className="flex flex-col border-r border-black">
          <Field
            label="Customer Name"
            value={data.clientName}
            valueClassName={BLUE_VALUE}
          />
          <Field label="Address" value={data.clientAddress} valueClassName={BLUE_VALUE} />
          <Field label="Tin Number" value={data.clientTin} valueClassName={BLUE_VALUE} />
          <Field label="Project Name" value={data.subject} valueClassName={BLUE_VALUE} />
          <Field label="Location" value="" />
          <Field
            label="Contact Persons"
            value={data.contactPersonName}
            valueClassName={BLUE_VALUE}
          />
          <Field
            label="Contact Number"
            value={data.contactNumber}
            valueClassName={BLUE_VALUE}
          />
          <Field label="Deliver/Ship to" value="" />
          <div className="flex-1 border-b border-black" />
          <div className="px-1 py-0.5 font-semibold text-neutral-800">
            Market Segment:
          </div>
        </div>

        {/* Right column: sale details */}
        <div className="flex flex-col">
          <CheckboxRow
            label="Type of Sale"
            options={["GOODS", "LOOSE SUPPLY", "INSTALLATION", "OTHERS"]}
          />
          <Field label="Payment Terms" value={data.paymentTerms} />
          <Field label="Contract Amount" value={formatCurrency(data.poAmount)} />
          <div className="grid grid-cols-3 border-b border-black">
            <Field
              label="Customer PO#"
              value={quotationOrPoNumber}
              className="border-0 border-r"
            />
            <Field
              label="PO Date"
              value={formatDate(data.poDate)}
              className="border-0 border-r"
            />
            <Field
              label="Quotation #"
              value={data.quotationNumber}
              className="border-0"
            />
          </div>
          <Field
            label="Leadtime/Target Completion Date"
            value={
              data.expectedCompletion
                ? formatDate(data.expectedCompletion)
                : data.leadTimeDays !== null
                  ? `${data.leadTimeDays} day${data.leadTimeDays === 1 ? "" : "s"}`
                  : ""
            }
          />
          <YesNoDetailField label="Penalty Clause" detailLabel="Details" />
          <YesNoDetailField label="Insurance required" detailLabel="Type" />
          <Field label="Mode of Shipment" value="" />
          <CheckboxRow
            label=""
            options={["BOAT", "LCL", "CONTAINER", "TRUCK", "OTHERS"]}
            className="justify-end border-b-0"
          />
        </div>
      </div>

      {/* Full-width special instructions banner */}
      <Field label="SPECIAL INSTRUCTIONS" value={data.notes} />

      {/* Item table */}
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "4%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "32%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "16%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="border border-black p-1 font-normal">Item</th>
            <th className="border border-black bg-neutral-300 p-1 font-semibold">
              Item Code
            </th>
            <th className="border border-black bg-neutral-300 p-1 font-semibold">
              Description
            </th>
            <th className="border border-black bg-neutral-300 p-1 font-semibold">Qty</th>
            <th className="border border-black bg-neutral-300 p-1 font-semibold">Unit</th>
            <th className="border border-black bg-neutral-300 p-1 font-semibold">
              Unit Price
            </th>
            <th className="border border-black bg-neutral-400 p-1 font-semibold">
              Total Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-1 text-center">1</td>
            <td className="border border-black p-1">&nbsp;</td>
            <td className={`border border-black p-1 ${MAROON_VALUE}`}>{data.subject}</td>
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
        </tbody>
      </table>

      {/* Attachments label + Grand Total badge */}
      <div className="flex items-center justify-between px-1 py-1">
        <span className="font-semibold">ATTACHMENTS:</span>
        <div className="flex items-center gap-2 bg-neutral-400 px-2 py-0.5">
          <span className="font-bold">GRAND TOTAL :</span>
          <span className="font-bold">{formatCurrency(data.poAmount)}</span>
        </div>
      </div>

      {/* Bottom grid: attachments checklist | production/qa | signatures | remarks */}
      <div className="grid grid-cols-[1.5fr_0.9fr_1.8fr_1.6fr] gap-x-2 border-t border-black p-1.5">
        <div className="flex flex-col gap-0.5">
          {ATTACHMENT_ITEMS.map((item) => (
            <Checkbox key={item} label={item} />
          ))}
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-baseline gap-1">
            <span className="shrink-0 font-semibold text-neutral-800">Production:</span>
            <span className="flex-1 border-b border-black">&nbsp;</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="shrink-0 font-semibold text-neutral-800">QA / QC:</span>
            <span className="flex-1 border-b border-black">&nbsp;</span>
          </div>
        </div>

        <div className="flex flex-col">
          <SignatureLine label="Prepared by (SE)" value={data.salesPersonName} />
          <SignatureLine label="Checked by (SM)" />
          <SignatureLine label="Checked by (JRC)" />
          <SignatureLine label="Noted by (ACCTG)" />
          <SignatureLine label="Noted by (ENGG)" />
          <SignatureLine label="Approved by (JGV)" />
        </div>

        <div className={`flex flex-col gap-2 border border-black p-2 ${BAND_BG}`}>
          <span className="font-semibold">REMARKS:</span>
          <div className="flex flex-1 flex-col justify-between gap-3 pb-1">
            <span className="border-b border-black">&nbsp;</span>
            <span className="border-b border-black">&nbsp;</span>
            <span className="border-b border-black">&nbsp;</span>
          </div>
        </div>
      </div>

      <div className="border-t border-black p-1 text-right text-[8px] text-neutral-500">
        FO-55 (06 AUGUST 2025)
      </div>
    </div>
  );
}
