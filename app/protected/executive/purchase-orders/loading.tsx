import { Skeleton } from "@/components/ui/skeleton";

export default function ExecutivePurchaseOrdersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-16 w-full rounded-none" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
