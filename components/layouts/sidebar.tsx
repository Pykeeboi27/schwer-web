"use client";

import { usePathname } from "next/navigation";
import { getNavConfig } from "@/components/layouts/nav-config";
import { SidebarNav } from "@/components/layouts/sidebar-nav";
import type { NotificationSection } from "@/lib/notifications/types";

type SidebarProps = {
  currentUserRole?: string | null;
  unseenSections?: NotificationSection[];
};

/**
 * Desktop navigation rail. Hidden below `md`, where the top-bar hamburger opens
 * the `MobileNav` drawer instead. Sticks under the top nav as you scroll.
 */
export function Sidebar({ currentUserRole, unseenSections }: SidebarProps) {
  const pathname = usePathname();
  const config = getNavConfig(pathname, currentUserRole);

  if (!config) {
    return null;
  }

  return (
    <aside className="hidden md:block md:w-56 md:shrink-0">
      <div className="sticky top-20 rounded-lg border bg-card p-3 shadow-xs">
        <SidebarNav config={config} pathname={pathname} unseenSections={unseenSections} />
      </div>
    </aside>
  );
}
