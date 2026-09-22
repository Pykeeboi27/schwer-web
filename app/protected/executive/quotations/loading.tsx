import { Skeleton } from "@/components/ui/skeleton";

export default function ExecutiveQuotationsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-16 w-full rounded-none" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
