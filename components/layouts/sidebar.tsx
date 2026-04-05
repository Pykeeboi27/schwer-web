"use client";

import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMediaQuery } from "../../lib/utils/useMediaQuery";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const pathname = usePathname();
  const isExecutiveRoute = pathname.startsWith("/protected/executive");

  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [pathname, isMobile]);

  const navItems = isExecutiveRoute
    ? [
        { href: "/protected/executive", label: "Dashboard" },
        { href: "/protected/executive/approvals", label: "Approvals" },
      ]
    : [
        { href: "/protected/sales/clients", label: "Clients" },
        { href: "/protected/sales/quotations", label: "Quotations" },
        { href: "/protected/sales/purchase-orders", label: "Purchase Orders" },
      ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="fixed left-4 top-20 z-50 md:hidden"
          aria-label={isExecutiveRoute ? "Toggle executive navigation" : "Toggle sales navigation"}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      )}

      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 border-r bg-background transition-transform duration-300 ease-in-out
          md:static md:h-fit md:rounded-md md:border
          ${isMobile ? (isOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0"}
        `}
      >
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">
            {isExecutiveRoute ? "Executive Dashboard" : "Sales Dashboard"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Workspace navigation</p>
        </div>

        <nav className="space-y-2 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                block rounded-md px-3 py-2 text-sm transition-colors
                ${
                  isActive(item.href)
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
