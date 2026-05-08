"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ENGINEERING_TABS = [
  { href: "/protected/engineering", label: "Dashboard" },
  { href: "/protected/engineering/quotations", label: "Quotations" },
];

function isTabActive(pathname: string, href: string): boolean {
  if (href === "/protected/engineering") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function EngineeringLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <nav className="rounded-md border bg-card p-2" aria-label="Engineering section tabs">
        <ul className="flex flex-wrap items-center gap-2 text-sm">
          {ENGINEERING_TABS.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "inline-flex rounded-md px-3 py-1.5 transition-colors",
                  isTabActive(pathname, tab.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
