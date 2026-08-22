"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

type TablePaginationProps = {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Row count *after* filtering, not the unfiltered total. */
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  /** Plural noun for the count summary, e.g. "purchase orders". */
  itemLabel?: string;
  className?: string;
};

/** Total pages for a row count, never below 1 so an empty list still reads "Page 1 of 1". */
export function getPageCount(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

/** Clamps a 1-based page into range -- guards a filter change shrinking the list. */
export function clampPage(page: number, totalItems: number, pageSize: number): number {
  return Math.min(Math.max(1, page), getPageCount(totalItems, pageSize));
}

/** The slice bounds for `page`, as an inclusive 1-based display range plus array indices. */
export function getPageRange(
  page: number,
  pageSize: number,
  totalItems: number,
): { start: number; end: number; firstItem: number; lastItem: number } {
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  return {
    start,
    end,
    firstItem: totalItems === 0 ? 0 : start + 1,
    lastItem: end,
  };
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  itemLabel = "items",
  className,
}: TablePaginationProps) {
  const pageCount = getPageCount(totalItems, pageSize);
  const { firstItem, lastItem } = getPageRange(page, pageSize, totalItems);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground" aria-live="polite" role="status">
        {totalItems === 0
          ? `No ${itemLabel}`
          : `Showing ${firstItem}–${lastItem} of ${totalItems} ${itemLabel}`}
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[74px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
