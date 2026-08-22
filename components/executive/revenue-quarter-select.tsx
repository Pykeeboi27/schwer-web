"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getQuarterLabel } from "@/lib/executive/period";
import { useRouter } from "next/navigation";

type RevenueQuarterSelectProps = {
  selectedQuarter: number;
  currentQuarter: number;
};

export function RevenueQuarterSelect({
  selectedQuarter,
  currentQuarter,
}: RevenueQuarterSelectProps) {
  const router = useRouter();

  const quarters = Array.from({ length: currentQuarter }, (_, index) => index + 1);

  return (
    <Select
      value={String(selectedQuarter)}
      onValueChange={(value) => {
        router.push(`/protected/executive/sales?period=quarterly&quarter=${value}`);
      }}
    >
      <SelectTrigger className="w-[160px]" aria-label="Select quarter">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {quarters.map((quarter) => (
          <SelectItem key={quarter} value={String(quarter)}>
            {getQuarterLabel(quarter)}
            {quarter === currentQuarter ? " (current)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
