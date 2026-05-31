import { ThemeSwitcher } from "@/components/theme-switcher";
import { SchwerLogo } from "@/components/schwer-logo";
import { Layers, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Secure Access",
    description:
      "Supabase Auth with profile-aware routing and protected department dashboards.",
  },
  {
    icon: Workflow,
    title: "Department-first Flow",
    description:
      "Users without a department are guided to onboarding before entering protected pages.",
  },
  {
    icon: Layers,
    title: "Unified Operations",
    description:
      "Keep teams aligned with a single source of truth for business workflows.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-secondary/20 via-background to-background text-foreground">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-base font-semibold tracking-tight transition-opacity hover:opacity-80"
          >
            <SchwerLogo className="h-7" />
            <span className="hidden sm:inline">Schwer Online Management</span>
          </Link>
          <ThemeSwitcher />
        </header>

        {/* Hero */}
        <section className="flex flex-1 flex-col items-start justify-center py-16">
          <div className="flex items-center gap-3 mb-6">
            <SchwerLogo className="h-12" />
          </div>

          <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Schwer ERP Portal
          </span>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Schwer Online<br className="hidden sm:block" /> Management
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Centralize operations for HR, Sales, Accounting, Engineering, and
            Purchasing in one secure system.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Login
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-7 text-sm font-medium transition-all hover:bg-muted hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Sign up
            </Link>
          </div>

          {/* Feature cards */}
          <div className="mt-16 grid w-full gap-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4.5 w-4.5 text-primary" size={18} />
                </div>
                <h2 className="text-sm font-semibold text-primary">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
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
