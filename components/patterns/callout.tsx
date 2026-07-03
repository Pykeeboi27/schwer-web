import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type CalloutTone = "info" | "success" | "warning" | "destructive" | "muted";

const TONE_CLASSES: Record<CalloutTone, string> = {
  info: "border-blue-200 bg-blue-50/60 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
  success:
    "border-green-200 bg-green-50/70 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200",
  warning:
    "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/40 text-foreground",
};

type CalloutProps = {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * A bordered, tinted panel for inline semantic messages inside dialogs and
 * forms. Replaces the four ad-hoc colored panel recipes (blue info, green
 * success, destructive banner, neutral muted) that were copy-pasted around.
 */
export function Callout({ tone = "muted", title, children, className }: CalloutProps) {
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", TONE_CLASSES[tone], className)}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
    </div>
  );
}
