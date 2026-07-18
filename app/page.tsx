import { ThemeSwitcher } from "@/components/theme-switcher";
import { SchwerLogo } from "@/components/schwer-logo";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * Public landing page, set on a drafting-sheet frame: the content column is
 * ruled with hairline borders and crosshair marks sit at the line
 * intersections, echoing the engineering drawings behind every Schwer
 * quotation. The only color accents are the primary full stop closing the
 * headline — repeated on the auth shell's brand panel — and the primary ticks
 * on the eyebrow and process rail.
 */
const PROCESS = [
  { step: "01", label: "Costing" },
  { step: "02", label: "Quotation" },
  { step: "03", label: "Purchase order" },
  { step: "04", label: "Collection" },
] as const;

const DEPARTMENTS = [
  { name: "Engineering", role: "Prepares direct costs" },
  { name: "Sales", role: "Prices, closes, collects" },
  { name: "Executive", role: "Approves and tracks" },
] as const;

/** Crosshair mark centered on a rule intersection, drafting-sheet style. */
function CrossMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute hidden h-[9px] w-[9px] md:block",
        className,
      )}
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-muted-foreground/50" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-muted-foreground/50" />
    </span>
  );
}

const enter =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-700 motion-reduce:animate-none";

export default function Home() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col md:border-x">
        {/* Header */}
        <header className="relative flex items-center justify-between border-b px-6 py-6 md:px-10">
          <CrossMark className="-bottom-[5px] -left-[5px]" />
          <CrossMark className="-bottom-[5px] -right-[5px]" />
          <Link
            href="/"
            className="inline-flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <SchwerLogo className="h-6" />
            <span className="text-sm font-semibold tracking-tight">
              Schwer Online Management
            </span>
          </Link>
          <ThemeSwitcher />
        </header>

        {/* Hero */}
        <section className="grid flex-1 items-center gap-12 px-6 py-16 md:px-10 md:py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            <p
              className={cn(
                "inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground",
                enter,
              )}
            >
              <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
              Schwer ERP Portal
            </p>

            <h1
              className={cn(
                "mt-5 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.02em] sm:text-5xl md:text-6xl",
                enter,
              )}
              style={{ animationDelay: "90ms" }}
            >
              From costing to collection
              <span className="text-primary">.</span>
            </h1>

            <p
              className={cn(
                "mt-6 max-w-lg text-base leading-relaxed text-muted-foreground",
                enter,
              )}
              style={{ animationDelay: "180ms" }}
            >
              The operations portal for Schwer PH — engineering prepares the
              cost, sales prices and closes it, executives approve and track it.
            </p>

            <div
              className={cn("mt-10 flex flex-wrap items-center gap-3", enter)}
              style={{ animationDelay: "270ms" }}
            >
              <Link
                href="/auth/login"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Login
              </Link>
              <Link
                href="/auth/sign-up"
                className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Sign up
              </Link>
            </div>

            <p
              className={cn("mt-4 text-xs text-muted-foreground", enter)}
              style={{ animationDelay: "340ms" }}
            >
              New accounts choose their department during sign-up.
            </p>
          </div>

          {/* Department index — quiet reference table, drafting-sheet margin note */}
          <dl
            className={cn("hidden w-60 border-l pl-8 lg:block", enter)}
            style={{ animationDelay: "300ms" }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Departments
            </p>
            {DEPARTMENTS.map((dept) => (
              <div
                key={dept.name}
                className="mt-5 border-t pt-4 first-of-type:mt-4"
              >
                <dt className="text-sm font-semibold tracking-tight">
                  {dept.name}
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {dept.role}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Process rail — the sequence the portal manages, in one quiet row */}
        <section className="relative border-t px-6 py-8 md:px-10">
          <CrossMark className="-left-[5px] -top-[5px]" />
          <CrossMark className="-right-[5px] -top-[5px]" />
          <ol className="grid gap-x-8 gap-y-5 sm:grid-cols-4">
            {PROCESS.map((stage) => (
              <li key={stage.step} className="relative pt-3">
                <span
                  className="absolute left-0 top-0 h-0.5 w-8 bg-primary"
                  aria-hidden="true"
                />
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-semibold tabular-nums text-primary">
                    {stage.step}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {stage.label}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-6 text-xs text-muted-foreground md:px-10">
          <p>© 2026 Schwer Online Management</p>
          <p>Internal use only</p>
        </footer>
      </div>
    </main>
  );
}
