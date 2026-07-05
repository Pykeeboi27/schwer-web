import { SchwerLogo } from "@/components/schwer-logo";
import Link from "next/link";

type AuthShellProps = {
  children: React.ReactNode;
  showBackLink?: boolean;
};

/**
 * Shared layout shell for all auth pages. Renders a plain centered background,
 * the Schwer logo wordmark, and an optional "Back to home" link above the
 * page-specific form content.
 */
export function AuthShell({ children, showBackLink = true }: AuthShellProps) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-4">
          {showBackLink && (
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              &larr; Back to home
            </Link>
          )}

          <Link href="/" className="inline-flex items-center gap-3">
            <SchwerLogo className="h-6" />
            <span className="text-sm font-semibold">Schwer Online Management</span>
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}
