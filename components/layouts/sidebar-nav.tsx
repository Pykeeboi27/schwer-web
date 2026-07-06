"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { isNavItemActive, type NavConfig } from "@/components/layouts/nav-config";

type SidebarNavProps = {
  config: NavConfig;
  pathname: string;
  /** Fired after a link is chosen — used to close the mobile drawer. */
  onNavigate?: () => void;
};

/**
 * Presentational nav list shared by the desktop rail (`Sidebar`) and the mobile
 * drawer (`MobileNav`). Keeps a single markup + active-state source so the two
 * never drift apart.
 */
export function SidebarNav({ config, pathname, onNavigate }: SidebarNavProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-3 pt-1">
        <p className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
          {config.module}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">Workspace</p>
      </div>

      <nav
        className="flex flex-1 flex-col gap-1"
        aria-label={`${config.module} navigation`}
      >
        {config.items.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-full bg-primary transition-all",
                  active ? "w-1 opacity-100" : "w-0 opacity-0",
                )}
              />
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground/70 group-hover:text-foreground",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
