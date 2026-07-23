import { Skeleton } from "@/components/ui/skeleton";

export default function ExecutivePurchaseOrdersLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
