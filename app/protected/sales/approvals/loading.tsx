import { Skeleton } from "@/components/ui/skeleton";

export default function SalesApprovalsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2 rounded-md border bg-card p-5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <section className="rounded-md border bg-card p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="space-y-2 rounded-md border p-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
