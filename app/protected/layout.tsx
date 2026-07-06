import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { SchwerLogo } from "@/components/schwer-logo";
import { ToastViewport } from "@/components/ui/toast-viewport";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import { SidebarSlot } from "@/components/layouts/sidebar-slot";
import { MobileNavSlot } from "@/components/layouts/mobile-nav-slot";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex w-full flex-1 flex-col">
        <nav className="sticky top-0 z-30 flex h-16 w-full justify-center border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-1">
              <Suspense fallback={null}>
                <MobileNavSlot />
              </Suspense>
              <Link
                href={"/"}
                className="inline-flex min-w-0 items-center gap-2.5 font-semibold"
              >
                <SchwerLogo className="h-7 shrink-0" />
                <span className="truncate text-sm sm:text-base">
                  Schwer Online Management
                </span>
              </Link>
            </div>
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense
                fallback={
                  <div className="text-sm text-muted-foreground">Loading account...</div>
                }
              >
                <AuthButton />
              </Suspense>
            )}
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

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8 text-muted-foreground">
          <p>Schwer Online Management</p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
