import { Skeleton } from "@/components/ui/skeleton";

export default function CostingApprovalsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-16 w-full rounded-none" />

      <section className="rounded-lg border bg-card p-4 shadow-xs sm:p-5">
        <Skeleton className="mb-4 h-5 w-44 rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-xs sm:p-5">
        <Skeleton className="mb-4 h-5 w-40 rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </section>
    </div>
  );
}
