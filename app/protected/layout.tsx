import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { SchwerLogo } from "@/components/schwer-logo";
import { ToastViewport } from "@/components/ui/toast-viewport";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import { SidebarSlot } from "@/components/layouts/sidebar-slot";
import { NavModuleBadge } from "@/components/layouts/nav-module-badge";
import { MobileNavSlot } from "@/components/layouts/mobile-nav-slot";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex w-full flex-1 flex-col">
        <nav className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Brand beam: the logo/PageHeader bar motif at global scale. */}
          <div aria-hidden="true" className="h-0.5 w-full bg-primary" />
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-1">
              <Suspense fallback={null}>
                <MobileNavSlot />
              </Suspense>
              <Link href={"/"} className="inline-flex min-w-0 items-center gap-2.5">
                <SchwerLogo className="h-7 shrink-0" />
                <span className="truncate text-sm sm:text-base">
                  <span className="font-semibold tracking-tight">Schwer</span>
                  <span className="hidden text-muted-foreground sm:inline">
                    {" "}
                    Online Management
                  </span>
                </span>
              </Link>
              <NavModuleBadge />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <ThemeSwitcher />
              {!hasEnvVars ? (
                <EnvVarWarning />
              ) : (
                <Suspense
                  fallback={
                    <div className="text-sm text-muted-foreground">
                      Loading account...
                    </div>
                  }
                >
                  <AuthButton />
                </Suspense>
              )}
            </div>
          </div>
        </nav>
        <Suspense
          fallback={
            <div className="mx-auto w-full max-w-5xl p-5 text-sm text-muted-foreground">
              Loading page...
            </div>
          }
        >
          <div className="flex-1 w-full">
            <DashboardLayout sidebar={<SidebarSlot />}>{children}</DashboardLayout>
          </div>
        </Suspense>
        <ToastViewport />

        <footer className="mx-auto flex w-full items-center justify-center border-t py-8 text-center text-xs text-muted-foreground">
          <p>Schwer Online Management</p>
        </footer>
      </div>
    </main>
  );
}
