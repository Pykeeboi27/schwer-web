import { Skeleton } from "@/components/ui/skeleton";

export default function ExecutiveDashboardLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
