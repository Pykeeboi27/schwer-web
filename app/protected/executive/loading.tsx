import { Skeleton } from "@/components/ui/skeleton";

export default function ExecutiveDashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-16 w-full rounded-none" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
