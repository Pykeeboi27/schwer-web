import { ThemeSwitcher } from "@/components/theme-switcher";
import { SchwerLogo } from "@/components/schwer-logo";
import Link from "next/link";

/**
 * Public landing page. A thin header, a vertically centered typographic hero,
 * a single-row process rail, and a one-line footer. The only accents are the
 * primary-colored full stop closing the headline — echoed on the auth shell's
 * brand panel — and the small primary ticks on the eyebrow and rail.
 */
const PROCESS = [
  { step: "01", label: "Costing" },
  { step: "02", label: "Quotation" },
  { step: "03", label: "Purchase order" },
  { step: "04", label: "Collection" },
] as const;

export default function Home() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 md:px-10">
        {/* Header */}
        <header className="flex items-center justify-between border-b py-6">
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
        <section className="flex flex-1 flex-col justify-center py-16 md:py-20">
          <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
            Schwer ERP Portal
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.02em] sm:text-5xl md:text-6xl">
            From costing to collection
            <span className="text-primary">.</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">
            The operations portal for Schwer PH — engineering prepares the cost,
            sales prices and closes it, executives approve and track it.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
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

          <p className="mt-4 text-xs text-muted-foreground">
            New accounts choose their department during sign-up.
          </p>
        </section>

        {/* Process rail — the sequence the portal manages, in one quiet row */}
        <section className="border-t py-8">
          <ol className="grid gap-x-8 gap-y-4 sm:grid-cols-4">
            {PROCESS.map((stage) => (
              <li key={stage.step} className="flex items-baseline gap-3">
                <span className="text-xs font-semibold tabular-nums text-primary">
                  {stage.step}
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {stage.label}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t py-6 text-xs text-muted-foreground">
          <p>© 2026 Schwer Online Management</p>
          <p>Internal use only</p>
        </footer>
      </div>
    </main>
  );
}
