import { SchwerLogo } from "@/components/schwer-logo";
import Link from "next/link";

type AuthShellProps = {
  children: React.ReactNode;
  showBackLink?: boolean;
};

/**
 * Shared layout shell for all auth pages. Split-screen: a slate brand panel
 * (bg-secondary, otherwise unused in the UI) on the left carries the identity,
 * the form sits on a plain surface on the right. The panel collapses to a
 * compact top strip below `lg` so the form stays full-width on mobile.
 */
export function AuthShell({ children, showBackLink = true }: AuthShellProps) {
  return (
    <div className="grid min-h-svh w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      {/* Desktop brand panel */}
      <div className="hidden flex-col justify-between bg-secondary p-10 text-secondary-foreground lg:flex xl:p-12 2xl:p-16">
        <Link href="/" className="inline-flex items-center gap-3">
          <SchwerLogo
            className="h-9 xl:h-10"
            barColor="hsl(var(--secondary-foreground))"
          />
        </Link>

        <div className="space-y-4 xl:space-y-5">
          <p className="text-base font-medium text-secondary-foreground/70 xl:text-lg">
            Schwer ERP Portal
          </p>
          <h2 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight xl:max-w-md xl:text-5xl">
            Schwer Online Management
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-secondary-foreground/70 xl:max-w-md xl:text-lg">
            Centralized operations for Sales, Engineering, and Executive teams.
          </p>
        </div>

        {showBackLink ? (
          <Link
            href="/"
            className="inline-flex items-center text-base font-medium text-secondary-foreground/70 transition-colors hover:text-secondary-foreground"
          >
            &larr; Back to home
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>

      {/* Mobile brand strip */}
      <div className="flex items-center justify-between gap-3 bg-secondary px-4 py-2.5 text-secondary-foreground sm:px-6 lg:hidden">
        <Link href="/" className="inline-flex min-w-0 items-center gap-2.5">
          <SchwerLogo
            className="h-5 shrink-0"
            barColor="hsl(var(--secondary-foreground))"
          />
          <span className="truncate text-sm font-semibold">Schwer Online Management</span>
        </Link>
      </div>

      {/* Form column */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          {showBackLink && (
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              &larr; Back to home
            </Link>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
