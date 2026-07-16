"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMonthLabel } from "@/lib/executive/period";
import { useRouter } from "next/navigation";

type RevenueMonthSelectProps = {
  selectedMonth: number;
  currentMonth: number;
};

export function RevenueMonthSelect({
  selectedMonth,
  currentMonth,
}: RevenueMonthSelectProps) {
  const router = useRouter();

  const months = Array.from({ length: currentMonth }, (_, index) => index + 1);

  return (
    <Select
      value={String(selectedMonth)}
      onValueChange={(value) => {
        router.push(`/protected/executive/sales?period=monthly&month=${value}`);
      }}
    >
      <SelectTrigger className="w-[160px]" aria-label="Select month">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((month) => (
          <SelectItem key={month} value={String(month)}>
            {getMonthLabel(month)}
            {month === currentMonth ? " (current)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
