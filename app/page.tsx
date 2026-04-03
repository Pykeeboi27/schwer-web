import { ThemeSwitcher } from "@/components/theme-switcher";
import { SchwerLogo } from "@/components/schwer-logo";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-secondary/20 via-background to-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 text-lg font-semibold tracking-tight">
            <SchwerLogo className="h-7" />
            Schwer Online Management
          </Link>
          <ThemeSwitcher />
        </header>

        <section className="flex flex-1 flex-col items-start justify-center py-16">
          <SchwerLogo className="h-14" />
          <p className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Schwer ERP Portal
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Schwer Online Management
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            Centralize operations for HR, Sales, Accounting, Engineering, and Purchasing in one secure system.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
            >
              Login
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium"
            >
              Sign up
            </Link>
          </div>

          <div className="mt-14 grid w-full gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold text-primary">Secure Access</h2>
              <p className="mt-2 text-sm text-muted-foreground">Supabase Auth with profile-aware routing and protected department dashboards.</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold text-primary">Department-first Flow</h2>
              <p className="mt-2 text-sm text-muted-foreground">Users without a department are guided to onboarding before entering protected pages.</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold text-primary">Unified Operations</h2>
              <p className="mt-2 text-sm text-muted-foreground">Keep teams aligned with a single source of truth for business workflows.</p>
            </div>
          </div>
        </section>

        <footer className="border-t py-6 text-sm text-muted-foreground">
          <p>Schwer Online Management</p>
        </footer>
      </div>
    </main>
  );
}
