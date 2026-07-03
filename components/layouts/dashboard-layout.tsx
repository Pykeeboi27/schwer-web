"use client";

import { Sidebar } from "@/components/layouts/Sidebar";
import { usePathname } from "next/navigation";

type DashboardLayoutProps = {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
};

export function DashboardLayout({ children, sidebar }: DashboardLayoutProps) {
  const pathname = usePathname();
  const isSalesRoute = pathname.startsWith("/protected/sales");
  const isExecutiveRoute = pathname.startsWith("/protected/executive");

  if (!isSalesRoute && !isExecutiveRoute) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-5 p-4 sm:p-6 lg:p-8 md:gap-8">
      {sidebar ?? <Sidebar />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
