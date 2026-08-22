import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  TablePagination,
  clampPage,
  getPageCount,
  getPageRange,
} from "@/components/patterns";

describe("pagination math", () => {
  it("counts pages, never dropping below one", () => {
    expect(getPageCount(0, 25)).toBe(1);
    expect(getPageCount(25, 25)).toBe(1);
    expect(getPageCount(26, 25)).toBe(2);
    expect(getPageCount(100, 25)).toBe(4);
  });

  it("clamps a page into range when the row count shrinks", () => {
    expect(clampPage(7, 100, 25)).toBe(4);
    expect(clampPage(0, 100, 25)).toBe(1);
    expect(clampPage(2, 100, 25)).toBe(2);
    // A filter that leaves no rows still resolves to page 1.
    expect(clampPage(3, 0, 25)).toBe(1);
  });

  it("derives slice bounds and the 1-based display range", () => {
    expect(getPageRange(1, 25, 60)).toEqual({
      start: 0,
      end: 25,
      firstItem: 1,
      lastItem: 25,
    });
    // Last page is short: end is capped at the row count.
    expect(getPageRange(3, 25, 60)).toEqual({
      start: 50,
      end: 60,
      firstItem: 51,
      lastItem: 60,
    });
    expect(getPageRange(1, 25, 0)).toEqual({
      start: 0,
      end: 0,
      firstItem: 0,
      lastItem: 0,
    });
  });
});

describe("TablePagination", () => {
  it("summarizes the visible range and pages forward", () => {
    const onPageChange = vi.fn();

    render(
      <TablePagination
        page={2}
        pageSize={25}
        totalItems={60}
        itemLabel="purchase orders"
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 26–50 of 60 purchase orders",
    );
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables the edges on a single-page result set", () => {
    render(
      <TablePagination
        page={1}
        pageSize={25}
        totalItems={0}
        itemLabel="purchase orders"
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No purchase orders");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("omits the rows-per-page control when no handler is supplied", () => {
    const { rerender } = render(
      <TablePagination page={1} pageSize={25} totalItems={60} onPageChange={vi.fn()} />,
    );

    expect(
      screen.queryByRole("combobox", { name: "Rows per page" }),
    ).not.toBeInTheDocument();

    rerender(
      <TablePagination
        page={1}
        pageSize={25}
        totalItems={60}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Rows per page" })).toBeInTheDocument();
  });
});
