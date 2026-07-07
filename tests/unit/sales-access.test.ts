import { describe, expect, it } from "vitest";

import {
  canAccessSalesDashboard,
  canAccessSalesQuotations,
  canAccessSalesRoute,
  getSalesAccessRedirect,
  getSalesFallbackPath,
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
    expect(canAccessSalesRoute(ownerProfile, "/protected/sales/purchase-orders")).toBe(
      true,
    );
  });

  it("denies access to inactive or unauthorized profiles", () => {
    expect(canAccessSalesDashboard(null)).toBe(false);
    expect(canAccessSalesDashboard({ ...salesProfile, isActive: false })).toBe(false);
    expect(canAccessSalesQuotations(null)).toBe(false);
    expect(canAccessSalesQuotations({ ...salesProfile, isActive: false })).toBe(false);
    expect(
      canAccessSalesQuotations({
        ...salesProfile,
        department: "accounting",
        role: "staff",
      }),
    ).toBe(false);
  });

  it("resolves the correct fallback path for each profile state", () => {
    expect(getSalesFallbackPath(null)).toBe("/auth/login");
    expect(getSalesFallbackPath({ ...salesProfile, department: null })).toBe(
      "/auth/choose-department",
    );
    expect(getSalesFallbackPath(salesProfile)).toBe("/protected/sales");
    expect(getSalesFallbackPath(ownerProfile)).toBe("/protected/executive");
  });

  it("returns null when authorized and a fallback path otherwise", () => {
    expect(getSalesAccessRedirect(salesProfile, "/protected/sales")).toBeNull();
    expect(getSalesAccessRedirect(ownerProfile, "/protected/sales")).toBe(
      "/protected/executive",
    );
    expect(getSalesAccessRedirect(null, "/protected/sales")).toBe("/auth/login");
    expect(
      getSalesAccessRedirect(ownerProfile, "/protected/sales/quotations"),
    ).toBeNull();
  });
});
