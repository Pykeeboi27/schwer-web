import { ThemeSwitcher } from "@/components/theme-switcher";
import { SchwerLogo } from "@/components/schwer-logo";
import Link from "next/link";

/**
 * The landing page renders the company's actual pipeline, not generic feature
 * copy: engineering costs it, sales prices and closes it, executives approve
 * and track it. The hero's beam wall is the logo's bar motif at architectural
 * scale — the same vocabulary as BeamTick and PageHeader inside the app.
 */
const PIPELINE = [
  {
    step: "01",
    department: "Engineering",
    title: "Costing",
    description:
      "Direct costs are prepared per quotation and submitted for executive costing approval.",
  },
  {
    step: "02",
    department: "Sales",
    title: "Quotation & approval",
    description:
      "Margin, payment terms, and lead time are added, then routed through the approval chain.",
  },
  {
    step: "03",
    department: "Sales",
    title: "Purchase orders",
    description:
      "Approved quotations convert to POs, with every collection tracked against the total.",
  },
  {
    step: "04",
    department: "Executive",
    title: "Oversight",
    description:
      "Revenue targets, high-value approvals, and company-wide performance in one view.",
  },
];

const BEAM_WALL = [
  { label: "Engineering", height: "52%" },
  { label: "Sales", height: "66%" },
  { label: "Purchase Orders", height: "80%" },
  { label: "Executive", height: "94%" },
];

export default function Home() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-6 md:px-10">
        {/* Header */}
        <header className="flex items-center justify-between border-b py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <SchwerLogo className="h-7" />
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              Schwer Online Management
            </span>
          </Link>
          <ThemeSwitcher />
        </header>

        {/* Hero */}
        <section className="grid flex-1 items-center gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
              Schwer ERP Portal
            </p>

            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              From costing to collection.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              The Schwer PH operations portal — engineering prepares the cost, sales
              prices and closes it, executives approve and track every peso against
              target.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
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

            {/* Compact beam strip — mobile stand-in for the desktop beam wall */}
            <div
              className="mt-12 flex w-fit items-end gap-1.5 border-b-2 border-border pr-10 lg:hidden"
              aria-hidden="true"
            >
              <div className="flex h-10 w-2.5 flex-col gap-0.5">
                <span className="flex-1 rounded-[2px] bg-primary" />
                <span className="flex-1 rounded-[2px] bg-primary" />
              </div>
              <span className="h-8 w-2.5 rounded-[2px] bg-secondary/80" />
              <span className="h-11 w-2.5 rounded-[2px] bg-secondary/80" />
              <span className="h-14 w-2.5 rounded-[2px] bg-secondary/80" />
              <span className="h-16 w-2.5 rounded-[2px] bg-secondary/80" />
            </div>
          </div>

          {/* Beam wall — the logo's bar motif at architectural scale */}
          <div
            className="hidden h-[26rem] items-end gap-3 border-b-2 border-border xl:h-[30rem] lg:flex"
            aria-hidden="true"
          >
            <div className="flex h-full w-14 flex-col gap-2 motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-8 fill-mode-backwards duration-700 xl:w-16">
              <span className="flex-1 rounded-md bg-primary" />
              <span className="flex-1 rounded-md bg-primary" />
            </div>
            {BEAM_WALL.map((beam, index) => (
              <div key={beam.label} className="flex h-full items-end">
                <div
                  className="flex w-14 items-end justify-center rounded-md bg-secondary pb-4 motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-8 fill-mode-backwards duration-700 xl:w-16"
                  style={{
                    height: beam.height,
                    animationDelay: `${120 + index * 110}ms`,
                  }}
                >
                  <span className="rotate-180 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] text-secondary-foreground/70 [writing-mode:vertical-rl]">
                    {beam.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline rail */}
        <section className="border-t py-12 md:py-16">
          <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
            How work moves through Schwer
          </p>

          <ol className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((stage) => (
              <li key={stage.step} className="relative border-t-2 border-border pt-5">
                <span
                  className="absolute -top-0.5 left-0 h-0.5 w-10 bg-primary"
                  aria-hidden="true"
                />
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {stage.step}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {stage.department}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold tracking-tight">
                  {stage.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {stage.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Footer */}
        <footer className="border-t py-6 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>© 2026 Schwer Online Management</p>
            <p className="text-xs">Internal use only</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
