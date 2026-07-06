"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getNavConfig } from "@/components/layouts/nav-config";
import { SidebarNav } from "@/components/layouts/sidebar-nav";

type MobileNavProps = {
  currentUserRole?: string | null;
};

/**
 * Mobile-only navigation. Renders a hamburger in the top bar that opens a left
 * drawer with the same links as the desktop rail. Closes on route change.
 */
export function MobileNav({ currentUserRole }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const config = getNavConfig(pathname, currentUserRole);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!config) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-4 pt-6">
        <SheetTitle className="sr-only">{config.module} navigation</SheetTitle>
        <SidebarNav
          config={config}
          pathname={pathname}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
