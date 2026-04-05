import { cn } from "@/lib/utils";

type ExecutiveEmptyStateProps = {
  title: string;
  description: string;
  className?: string;
};

export function ExecutiveEmptyState({
  title,
  description,
  className,
}: ExecutiveEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed bg-muted/20 p-6 text-center",
        className,
      )}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
