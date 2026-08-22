import { Skeleton } from "@/components/ui/skeleton";

export default function ExecutiveSalesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-16 w-full rounded-none" />
      <Skeleton className="h-10 w-64 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
