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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10">
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

          <span className="text-sm font-medium text-primary">Schwer ERP Portal</span>

          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Schwer Online
            <br className="hidden sm:block" /> Management
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Centralize operations for HR, Sales, Accounting, Engineering, and Purchasing
            in one secure system.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Login
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-7 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Sign up
            </Link>
          </div>

          {/* Feature cards */}
          <div className="mt-16 grid w-full gap-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-lg border bg-card p-5">
                <Icon
                  className="mb-3 h-5 w-5 text-primary"
                  aria-hidden="true"
                  size={20}
                />
                <h2 className="text-sm font-semibold">{title}</h2>
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
