import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { SchwerLogo } from "@/components/schwer-logo";
import { ToastViewport } from "@/components/ui/toast-viewport";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import { SidebarSlot } from "@/components/layouts/sidebar-slot";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 w-full flex flex-col">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"} className="inline-flex items-center gap-3">
                <SchwerLogo className="h-7" />
                Schwer Online Management
              </Link>
            </div>
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense fallback={<div className="text-sm text-muted-foreground">Loading account...</div>}>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>
        <Suspense fallback={<div className="mx-auto w-full max-w-5xl p-5 text-sm text-muted-foreground">Loading page...</div>}>
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
