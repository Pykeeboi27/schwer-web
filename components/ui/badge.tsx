import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Small circular "unseen changes" indicator for nav tabs. No text/count. */
function NotificationDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full bg-primary", className)}
    />
  );
}

/** Circular unread-count bubble for the notification bell trigger. */
function CountBadge({
  count,
  className,
}: {
  count: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid h-[1.15rem] min-w-[1.15rem] shrink-0 place-items-center rounded-full bg-destructive px-1 text-[0.65rem] font-semibold leading-none text-destructive-foreground",
        className,
      )}
    >
      {count}
    </span>
  );
}

export { Badge, badgeVariants, NotificationDot, CountBadge };
