import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Optional action(s) rendered below the description (e.g. a "Clear search" button). */
  children?: ReactNode;
  className?: string;
};

/**
 * Single empty-state treatment. Replaces the three divergent variants that were
 * in use (in-row icon+text, bare `<p>`, and bordered card). Center-aligned,
 * muted, with an optional icon and optional action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
