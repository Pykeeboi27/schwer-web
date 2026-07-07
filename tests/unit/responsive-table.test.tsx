import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataCard, DataField, ResponsiveTable } from "@/components/patterns";

describe("ResponsiveTable", () => {
  it("renders both the table and the stacked cards slots", () => {
    render(
      <ResponsiveTable
        table={
          <table>
            <tbody>
              <tr>
                <td>table view</td>
              </tr>
            </tbody>
          </table>
        }
        cards={<div>cards view</div>}
      />,
    );

    expect(screen.getByText("table view")).toBeInTheDocument();
    expect(screen.getByText("cards view")).toBeInTheDocument();
  });
});

describe("DataCard", () => {
  it("renders header, fields, and footer without interactivity by default", () => {
    render(
      <DataCard header={<span>Q-1</span>} footer={<span>actions</span>}>
        <DataField label="Amount" value="₱1,500,000" />
      </DataCard>,
    );

    expect(screen.getByText("Q-1")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("₱1,500,000")).toBeInTheDocument();
    expect(screen.getByText("actions")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("activates on click and on Enter/Space when onActivate is provided", () => {
    const onActivate = vi.fn();
    render(
      <DataCard onActivate={onActivate} ariaLabel="Open Q-1">
        <DataField label="Status" value="Approved" />
      </DataCard>,
    );

    const card = screen.getByRole("button", { name: "Open Q-1" });

    fireEvent.click(card);
    expect(onActivate).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: "Enter" });
    expect(onActivate).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(card, { key: " " });
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it("ignores other keys", () => {
    const onActivate = vi.fn();
    render(
      <DataCard onActivate={onActivate} ariaLabel="Open Q-2">
        <DataField label="Status" value="Draft" />
      </DataCard>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Open Q-2" }), { key: "a" });
    expect(onActivate).not.toHaveBeenCalled();
  });
});
