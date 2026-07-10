import { PrintButton } from "@/components/sales/print-button";
import { SalesWorksheet } from "@/components/sales/sales-worksheet";
import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getSalesAccessRedirect } from "@/lib/sales/access";
import { getPurchaseOrderWorksheetData } from "@/lib/sales/worksheet";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type WorksheetPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseOrderWorksheetPage({ params }: WorksheetPageProps) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const redirectPath = getSalesAccessRedirect(
    profile,
    "/protected/sales/purchase-orders",
  );

  if (redirectPath) {
    redirect(redirectPath);
  }

  const data = await getPurchaseOrderWorksheetData(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white text-black">
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          html, body { background: white; }
        }
      `}</style>

      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b bg-neutral-100 px-4 py-3">
        <Link
          href="/protected/sales/purchase-orders"
          className="text-sm font-medium text-neutral-700 underline-offset-2 hover:underline"
        >
          ← Close
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[297mm] p-4 sm:p-8">
        <SalesWorksheet data={data} />
      </div>
    </div>
  );
}
