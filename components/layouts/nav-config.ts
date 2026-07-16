import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
  FilePlus,
  FileText,
  LayoutDashboard,
  LineChart,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match the pathname exactly (used for module dashboard roots). */
  end?: boolean;
};

export type NavConfig = {
  /** Human label for the current module, shown in the nav header. */
  module: string;
  items: NavItem[];
};

/**
 * Single source of truth for the workspace sidebar. Both the desktop rail and
 * the mobile drawer derive their links from this so the two navigation systems
 * that used to exist (sidebar + per-module tab bars) are now one.
 *
 * Returns `null` for routes that have no module navigation (e.g. the generic
 * `[department]` landing pages), so no sidebar/hamburger renders there.
 */
export function getNavConfig(pathname: string, role?: string | null): NavConfig | null {
  if (pathname.startsWith("/protected/executive")) {
    return {
      module: "Executive",
      items: [
        {
          href: "/protected/executive",
          label: "Dashboard",
          icon: LayoutDashboard,
          end: true,
        },
        { href: "/protected/executive/sales", label: "Sales", icon: LineChart },
        { href: "/protected/executive/approvals", label: "Approvals", icon: BadgeCheck },
        {
          href: "/protected/executive/costing-approvals",
          label: "Costing Approval",
          icon: ClipboardCheck,
        },
      ],
    };
  }

  if (pathname.startsWith("/protected/engineering")) {
    return {
      module: "Engineering",
      items: [
        {
          href: "/protected/engineering",
          label: "Dashboard",
          icon: LayoutDashboard,
          end: true,
        },
        {
          href: "/protected/engineering/quotations",
          label: "Quotations",
          icon: FileText,
        },
      ],
    };
  }

  if (pathname.startsWith("/protected/sales")) {
    return {
      module: "Sales",
      items: [
        {
          href: "/protected/sales",
          label: "Dashboard",
          icon: LayoutDashboard,
          end: true,
        },
        { href: "/protected/sales/clients", label: "Clients", icon: Building2 },
        {
          href: "/protected/sales/request-for-quotation",
          label: "Request for Quotation",
          icon: FilePlus,
        },
        { href: "/protected/sales/quotations", label: "Quotations", icon: FileText },
        {
          href: "/protected/sales/purchase-orders",
          label: "Purchase Orders",
          icon: Receipt,
        },
        ...(role === "sales_manager"
          ? [
              {
                href: "/protected/sales/approvals",
                label: "Approvals",
                icon: BadgeCheck,
              },
            ]
          : []),
      ],
    };
  }

  return null;
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.end) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
