import { describe, expect, it } from "vitest";

import {
  canAccessSalesDashboard,
  canAccessSalesQuotations,
  canAccessSalesRoute,
} from "@/lib/sales/access";

describe("sales access helpers", () => {
  const salesProfile = {
    id: "u-sales",
    email: "sales@example.com",
    department: "sales",
    isActive: true,
    role: "sales_staff",
  } as const;

  const ownerProfile = {
    id: "u-owner",
    email: "owner@example.com",
    department: "executive",
    isActive: true,
    role: "owner",
  } as const;

  it("allows active sales users to access dashboard", () => {
    expect(canAccessSalesDashboard(salesProfile)).toBe(true);
    expect(canAccessSalesDashboard(ownerProfile)).toBe(false);
  });

  it("allows owner/executive approvers to access quotations", () => {
    expect(canAccessSalesQuotations(ownerProfile)).toBe(true);
    expect(canAccessSalesQuotations(salesProfile)).toBe(true);
  });

  it("applies route-specific access rules", () => {
    expect(canAccessSalesRoute(ownerProfile, "/protected/sales")).toBe(false);
    expect(canAccessSalesRoute(ownerProfile, "/protected/sales/quotations")).toBe(true);
  });
});
