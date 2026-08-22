import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type CalloutTone = "info" | "success" | "warning" | "destructive" | "muted";

// info/success/warning read off the same --status-* tokens as StatusBadge
// (single source of truth); destructive/muted were already theme tokens and
// are left as-is.
const TONE_CLASSES: Record<CalloutTone, string> = {
  info: "border-status-info/30 bg-status-info/10 text-status-info",
  success: "border-status-approved/30 bg-status-approved/10 text-status-approved",
  warning: "border-status-pending/30 bg-status-pending/10 text-status-pending",
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
    <div
      className={cn("rounded-md border px-3 py-2 text-sm", TONE_CLASSES[tone], className)}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
    </div>
  );
}
