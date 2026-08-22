import { cn } from "@/lib/utils";
import type {
  HTMLAttributes,
  KeyboardEvent,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

/**
 * Codifies the table chrome that was hand-copied across ~10 files (executive,
 * sales, costing): a `bg-muted/40` head, `px-3 py-2` cells, and a `border-t`
 * row rule. Exported as both classNames (for the many tables that need a
 * per-column width or a custom cell) and thin wrapper components (for new
 * tables). Pair with `ResponsiveTable` for the card fallback below `md`.
 */
export const dataTableHeadClassName = "bg-muted/40 text-left";
export const dataTableHeaderCellClassName = "px-3 py-2 font-medium";
export const dataTableCellClassName = "px-3 py-2";
export const dataTableRowClassName = "border-t";
export const dataTableInteractiveRowClassName =
  "cursor-pointer border-t transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none";

export function DataTableHead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn(dataTableHeadClassName, className)} {...props} />;
}

export function DataTableHeaderCell({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn(dataTableHeaderCellClassName, className)} {...props} />;
}

export function DataTableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn(dataTableCellClassName, className)} {...props} />;
}

type DataTableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  /** Adds the row-button affordance (pointer, hover/focus wash, role="button", tabIndex). */
  interactive?: boolean;
};

export function DataTableRow({ interactive, className, ...props }: DataTableRowProps) {
  return (
    <tr
      className={cn(
        interactive ? dataTableInteractiveRowClassName : dataTableRowClassName,
        className,
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    />
  );
}

/** Enter/Space activates a `DataTableRow` the same way a click does. */
export function onDataTableRowKeyDown(
  event: KeyboardEvent<HTMLTableRowElement>,
  onActivate: () => void,
): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onActivate();
  }
}
