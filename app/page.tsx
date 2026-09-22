import { ThemeSwitcher } from "@/components/theme-switcher";
import { SchwerLogo } from "@/components/schwer-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * Public landing page. A drafting-sheet frame (hairline-ruled content column,
 * crosshair marks at the rule intersections) carries an oversized, light-weight
 * headline whose one keyword takes the text-only foreground-to-primary
 * gradient. A full-bleed graphite band breaks the white rhythm for the process
 * rail. Primary orange stays an accent: the full stop closing the headline —
 * repeated on the auth shell's brand panel — the eyebrow tick, the band rules,
 * and the login CTA.
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
    <main className="flex min-h-svh flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card shadow-card">
        <div className="mx-auto flex h-20 w-full max-w-5xl items-center justify-between px-6 md:px-10">
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
        </div>
      </header>

      {/* Hero */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col md:border-x">
        <CrossMark className="-bottom-[5px] -left-[5px]" />
        <CrossMark className="-bottom-[5px] -right-[5px]" />

        <section className="grid flex-1 items-center gap-12 px-6 py-24 md:px-10 md:py-28 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            <p
              className={cn(
                "inline-flex items-center gap-2.5 text-eyebrow uppercase text-muted-foreground",
                enter,
              )}
            >
              <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
              Schwer ERP Portal
            </p>

            <h1
              className={cn(
                "mt-6 max-w-3xl font-display text-5xl font-normal leading-[1.05] tracking-[-0.012em] sm:text-6xl lg:text-[4.75rem]",
                enter,
              )}
              style={{ animationDelay: "90ms" }}
            >
              From costing to{" "}
              <span className="bg-keyword bg-clip-text text-transparent">collection</span>
              <span className="text-primary">.</span>
            </h1>

            <p
              className={cn(
                "mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground",
                enter,
              )}
              style={{ animationDelay: "180ms" }}
            >
              The operations portal for Schwer PH — engineering prepares the cost, sales
              prices and closes it, executives approve and track it.
            </p>

            <div
              className={cn("mt-10 flex flex-wrap items-center gap-3", enter)}
              style={{ animationDelay: "270ms" }}
            >
              <Link href="/auth/login" className={buttonVariants({ size: "cta" })}>
                Login
              </Link>
              <Link
                href="/auth/sign-up"
                className={buttonVariants({ variant: "outline", size: "cta" })}
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
            <p className="text-eyebrow uppercase text-muted-foreground">Departments</p>
            {DEPARTMENTS.map((dept) => (
              <div key={dept.name} className="mt-5 border-t pt-4 first-of-type:mt-4">
                <dt className="text-sm font-semibold tracking-tight">{dept.name}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{dept.role}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* Process band — the sequence the portal manages, on the inverted surface */}
      <section className="bg-band text-band-foreground">
        <div className="mx-auto w-full max-w-5xl px-6 py-20 md:px-10">
          <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-4">
            {PROCESS.map((stage) => (
              <li key={stage.step} className="relative pt-6">
                <span
                  className="absolute left-0 top-0 h-0.5 w-8 bg-primary"
                  aria-hidden="true"
                />
                <span className="block font-display text-4xl font-semibold tabular-nums tracking-tight">
                  {stage.step}
                </span>
                <span className="mt-2 block text-eyebrow uppercase text-band-foreground/70">
                  {stage.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground md:px-10">
        <p>© 2026 Schwer Online Management</p>
        <p>Internal use only</p>
      </footer>
    </main>
  );
}
