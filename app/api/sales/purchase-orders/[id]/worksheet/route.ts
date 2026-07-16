import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { canAccessSalesRoute } from "@/lib/sales/access";
import { getPurchaseOrderWorksheetData } from "@/lib/sales/worksheet";
import { generatePurchaseOrderWorksheetXlsx } from "@/lib/sales/worksheet-xlsx";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const profile = await getCurrentProfile();

  if (!canAccessSalesRoute(profile, "/protected/sales/purchase-orders")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getPurchaseOrderWorksheetData(id);

  if (!data) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }

  const buffer = await generatePurchaseOrderWorksheetXlsx(data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${data.poNumber}-worksheet.xlsx"`,
    },
  });
}
