"use client";

import { Sidebar } from "@/components/layouts/sidebar";
import { usePathname } from "next/navigation";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const isSalesRoute = pathname.startsWith("/protected/sales");
  const isExecutiveRoute = pathname.startsWith("/protected/executive");

  if (!isSalesRoute && !isExecutiveRoute) {
    return <div className="mx-auto flex w-full max-w-5xl flex-col gap-20 p-5">{children}</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-5 p-5 md:gap-8">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
