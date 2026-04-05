import { cn } from "@/lib/utils";

type SchwerLogoProps = {
  className?: string;
};

export function SchwerLogo({ className }: SchwerLogoProps) {
  return (
    <svg
      viewBox="0 0 420 280"
      role="img"
      aria-label="Schwer logo"
      className={cn("h-10 w-auto", className)}
    >
      <rect x="0" y="0" width="420" height="280" rx="14" fill="transparent" />

      <rect x="8" y="18" width="88" height="116" rx="6" fill="hsl(var(--primary))" />
      <rect x="8" y="146" width="88" height="116" rx="6" fill="hsl(var(--primary))" />

      <rect x="108" y="18" width="88" height="244" rx="6" fill="hsl(var(--muted-foreground))" />
      <rect x="208" y="18" width="88" height="244" rx="6" fill="hsl(var(--muted-foreground))" />
      <rect x="308" y="18" width="88" height="244" rx="6" fill="hsl(var(--muted-foreground))" />
    </svg>
  );
}
