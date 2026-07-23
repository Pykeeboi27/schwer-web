import { SchwerLogo } from "@/components/schwer-logo";
import Link from "next/link";

type AuthShellProps = {
  children: React.ReactNode;
  showBackLink?: boolean;
};

/**
 * Shared layout shell for all auth pages. Split-screen: a quiet slate brand
 * panel on the left carries the logo, eyebrow, and tagline — its
 * primary-colored full stop matches the landing hero — while the form sits on
 * a plain surface on the right. The panel collapses to a compact top strip
 * below `lg` so the form stays full-width on mobile.
 */
export function AuthShell({ children, showBackLink = true }: AuthShellProps) {
  return (
    <div className="grid min-h-svh w-full grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:grid-rows-1">
      {/* Desktop brand panel */}
      <div className="hidden flex-col justify-between bg-secondary p-10 text-secondary-foreground lg:flex xl:p-12">
        <Link href="/" className="inline-flex items-center gap-3">
          <SchwerLogo className="h-8" barColor="hsl(var(--secondary-foreground))" />
          <span className="text-sm font-semibold tracking-tight">
            Schwer Online Management
          </span>
        </Link>

        <div className="space-y-5">
          <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-secondary-foreground/60">
            <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
            Schwer ERP Portal
          </p>

          <p className="max-w-sm text-3xl font-semibold leading-[1.1] tracking-[-0.02em] xl:text-4xl">
            From costing to collection
            <span className="text-primary">.</span>
          </p>

          <p className="max-w-xs text-sm leading-relaxed text-secondary-foreground/70">
            Every quotation, purchase order, and approval in one portal.
          </p>
        </div>

        <div className="space-y-6">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-secondary-foreground/50">
            Engineering&ensp;&middot;&ensp;Sales&ensp;&middot;&ensp;Executive
          </p>

          {showBackLink ? (
            <div className="border-t border-secondary-foreground/15 pt-6">
              <Link
                href="/"
                className="inline-flex items-center text-sm font-medium text-secondary-foreground/70 transition-colors hover:text-secondary-foreground"
              >
                &larr; Back to home
              </Link>
            </div>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Mobile brand strip */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-b-primary bg-secondary px-4 py-3 text-secondary-foreground sm:px-6 lg:hidden">
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
