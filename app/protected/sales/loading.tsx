import { Skeleton } from "@/components/ui/skeleton";

export default function SalesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3 rounded-md border bg-card p-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <section className="grid gap-3 rounded-md border bg-card p-5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded border p-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </section>

      <section className="rounded-md border bg-card p-5">
        <Skeleton className="mb-4 h-9 w-72" />
        <div className="space-y-2 rounded-md border p-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
