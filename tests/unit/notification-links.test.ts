import { describe, expect, it } from "vitest";

import { sectionForType } from "@/lib/notifications/links";
import type { NotificationType } from "@/lib/notifications/types";

describe("sectionForType", () => {
  it("maps approval-requested types to their approval sections", () => {
    expect(sectionForType("quotation_approval_requested")).toBe("approvals");
    expect(sectionForType("po_approval_requested")).toBe("approvals");
    expect(sectionForType("costing_approval_requested")).toBe("costing_approvals");
  });

  it("maps resolved quotation types to the Quotations tab", () => {
    expect(sectionForType("quotation_approved")).toBe("quotations");
    expect(sectionForType("quotation_rejected")).toBe("quotations");
  });

  it("maps resolved PO types to the Purchase Orders tab", () => {
    expect(sectionForType("po_approved")).toBe("purchase_orders");
    expect(sectionForType("po_rejected")).toBe("purchase_orders");
  });

  it("maps resolved costing types to the Request for Quotation tab", () => {
    expect(sectionForType("costing_approved")).toBe("request_for_quotation");
    expect(sectionForType("costing_rejected")).toBe("request_for_quotation");
  });

  it("maps engineering costing-quotation types to the Engineering Quotations tab", () => {
    expect(sectionForType("costing_quotation_received")).toBe("engineering_quotations");
    expect(sectionForType("costing_quotation_returned")).toBe("engineering_quotations");
    expect(sectionForType("costing_quotation_approved")).toBe("engineering_quotations");
  });

  it("maps the costing cost-updated type to the Request for Quotation tab", () => {
    expect(sectionForType("costing_cost_updated")).toBe("request_for_quotation");
  });

  it("covers every NotificationType with no unmapped fallthrough", () => {
    const allTypes: NotificationType[] = [
      "quotation_approval_requested",
      "quotation_approved",
      "quotation_rejected",
      "po_approval_requested",
      "po_approved",
      "po_rejected",
      "costing_approval_requested",
      "costing_approved",
      "costing_rejected",
      "costing_quotation_received",
      "costing_quotation_returned",
      "costing_cost_updated",
      "costing_quotation_approved",
    ];

    for (const type of allTypes) {
      expect(() => sectionForType(type)).not.toThrow();
    }
  });
});
