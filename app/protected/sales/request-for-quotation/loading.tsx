import { Skeleton } from "@/components/ui/skeleton";

export default function RequestForQuotationLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-44" />
      </div>

      <section className="rounded-md border bg-card p-5">
        <div className="space-y-2 rounded-md border p-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
