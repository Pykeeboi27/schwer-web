import { SignUpForm } from "@/components/sign-up-form";
import { SchwerLogo } from "@/components/schwer-logo";
import Link from "next/link";

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-gradient-to-br from-secondary/30 via-background to-background p-6 md:p-10">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />

      <div className="w-full max-w-sm space-y-4">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to home
        </Link>

        <div className="inline-flex items-center gap-3 rounded-lg border bg-background/70 px-3 py-2 backdrop-blur">
          <SchwerLogo className="h-6" />
          <span className="text-sm font-semibold">Schwer Online Management</span>
        </div>

        <SignUpForm />
      </div>
    </div>
  );
}
