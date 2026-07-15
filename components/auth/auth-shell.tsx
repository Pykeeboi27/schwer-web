import { SchwerLogo } from "@/components/schwer-logo";
import Link from "next/link";

type AuthShellProps = {
  children: React.ReactNode;
  showBackLink?: boolean;
};

const PANEL_PIPELINE = [
  { step: "01", label: "Engineering costing" },
  { step: "02", label: "Sales quotations & approvals" },
  { step: "03", label: "Purchase orders & collections" },
  { step: "04", label: "Executive oversight" },
] as const;

/**
 * Shared layout shell for all auth pages. Split-screen: a slate brand panel
 * on the left carries the identity — orange-tick eyebrow, the pipeline the
 * portal manages, and a beam strip echoing the logo's bar motif — while the
 * form sits on a plain surface on the right. The panel collapses to a compact
 * top strip below `lg` so the form stays full-width on mobile.
 */
export function AuthShell({ children, showBackLink = true }: AuthShellProps) {
  return (
    <div className="grid min-h-svh w-full grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:grid-rows-1">
      {/* Desktop brand panel */}
      <div className="hidden flex-col justify-between bg-secondary p-10 text-secondary-foreground lg:flex xl:p-12 2xl:p-16">
        <Link href="/" className="inline-flex items-center gap-3">
          <SchwerLogo
            className="h-9 xl:h-10"
            barColor="hsl(var(--secondary-foreground))"
          />
        </Link>

        <div className="space-y-5">
          <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-secondary-foreground/60">
            <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
            Schwer ERP Portal
          </p>

          <h2 className="max-w-md text-4xl font-semibold leading-[1.08] tracking-tight xl:text-5xl">
            Schwer Online Management
          </h2>

          <p className="max-w-sm text-base leading-relaxed text-secondary-foreground/70 xl:max-w-md">
            From costing to collection — every quotation, purchase order, and approval in
            one portal.
          </p>

          <ol className="space-y-2.5 pt-2">
            {PANEL_PIPELINE.map((stage) => (
              <li
                key={stage.step}
                className="flex items-baseline gap-3 text-sm text-secondary-foreground/70"
              >
                <span className="font-semibold tabular-nums text-primary">
                  {stage.step}
                </span>
                {stage.label}
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-8">
          {/* Beam strip — the logo's bar motif as a quiet baseline */}
          <div className="flex items-end gap-2" aria-hidden="true">
            <div className="flex h-10 w-3.5 flex-col gap-1">
              <span className="flex-1 rounded-sm bg-primary" />
              <span className="flex-1 rounded-sm bg-primary" />
            </div>
            <span className="h-8 w-3.5 rounded-sm bg-secondary-foreground/25" />
            <span className="h-12 w-3.5 rounded-sm bg-secondary-foreground/25" />
            <span className="h-16 w-3.5 rounded-sm bg-secondary-foreground/25" />
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
