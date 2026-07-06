import { cn } from "@/lib/utils";

type BeamTickProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Section-heading accent: a short orange notch echoing the logo's bar motif.
 * Renders inline (no heading tag of its own) so it can sit inside a `Panel`
 * `title` or be wrapped in a heading tag by the caller.
 */
export function BeamTick({ children, className }: BeamTickProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-primary" />
      {children}
    </span>
  );
}
