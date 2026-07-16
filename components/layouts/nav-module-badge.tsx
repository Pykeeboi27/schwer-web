"use client";

import { usePathname } from "next/navigation";
import { getNavConfig } from "@/components/layouts/nav-config";

/**
 * Shows which module you're in ("Sales" / "Executive" / "Engineering") next to
 * the wordmark in the top nav. Renders nothing outside module routes, and is
 * hidden below `md` where the sidebar/drawer already carries that context.
 */
export function NavModuleBadge() {
  const pathname = usePathname();
  const config = getNavConfig(pathname);

  if (!config) {
    return null;
  }

  return (
    <span className="ml-3 hidden items-center gap-3 md:flex">
      <span aria-hidden="true" className="h-5 w-px bg-border" />
      <span className="text-sm font-medium text-muted-foreground">{config.module}</span>
    </span>
  );
}
