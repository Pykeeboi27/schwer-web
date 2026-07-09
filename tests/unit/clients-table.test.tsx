import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mockDialogProps = vi.fn();

vi.mock("@/components/dialogs/client-details-dialog", () => ({
  ClientDetailsDialog: (props: {
    open: boolean;
    client: { companyName: string } | null;
    startInEditMode: boolean;
  }) => {
    mockDialogProps(props);
    if (!props.open || !props.client) return null;
    return (
      <div data-testid="mock-dialog">
        {props.client.companyName} — {props.startInEditMode ? "edit" : "view"}
      </div>
    );
  },
}));

import { ClientsTable } from "@/components/tables/clients-table";
import type { SalesClient } from "@/lib/sales/clients";

function makeClient(overrides: Partial<SalesClient>): SalesClient {
  return {
    id: "c1",
    clientCode: "C000001",
    companyName: "Alpha Corp",
    sector: "commercial",
    paymentTermsDays: 30,
    contactPerson: "Juan",
    email: "juan@alpha.com",
    phone: "0917",
    address: null,
    tin: null,
    birRegistrationLink: null,
    notes: null,
    isActive: true,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

const clients: SalesClient[] = [
  makeClient({
    id: "c1",
    clientCode: "C000001",
    companyName: "Alpha Corp",
    sector: "commercial",
  }),
  makeClient({
    id: "c2",
    clientCode: "C000002",
    companyName: "Beta Industrial",
    sector: "industrial",
  }),
  makeClient({
    id: "c3",
    clientCode: "C000003",
    companyName: "Gamma Solar",
    sector: "solar",
    contactPerson: null,
  }),
];

describe("ClientsTable", () => {
  it("renders every client once per view (table + mobile cards)", () => {
    render(<ClientsTable clients={clients} />);

    // Each client appears twice: once in the desktop <table>, once in the mobile <DataCard>.
    expect(screen.getAllByText("Alpha Corp")).toHaveLength(2);
    expect(screen.getAllByText("Beta Industrial")).toHaveLength(2);
    expect(screen.getAllByText("Gamma Solar")).toHaveLength(2);
  });

  it("filters by search text across code, name, contact, and sector", () => {
    render(<ClientsTable clients={clients} />);

    fireEvent.change(screen.getByLabelText("Search clients"), {
      target: { value: "beta" },
    });

    expect(screen.getAllByText("Beta Industrial")).toHaveLength(2);
    expect(screen.queryByText("Alpha Corp")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma Solar")).not.toBeInTheDocument();
  });

  it("shows an empty state with a clear-search action when the search matches nothing", () => {
    render(<ClientsTable clients={clients} />);

    fireEvent.change(screen.getByLabelText("Search clients"), {
      target: { value: "no-such-client" },
    });

    expect(screen.getAllByText("No results match your search.").length).toBeGreaterThan(
      0,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Clear search" })[0]);
    expect(screen.getAllByText("Alpha Corp")).toHaveLength(2);
  });

  it("shows the no-clients empty state without a clear action when there are no clients at all", () => {
    render(<ClientsTable clients={[]} />);

    expect(screen.getAllByText("No clients found.").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });

  it("filters by sector via the sector select", async () => {
    const user = userEvent.setup();
    render(<ClientsTable clients={clients} />);

    await user.click(screen.getByLabelText("Filter clients by sector"));
    await user.click(screen.getByRole("option", { name: "Solar" }));

    expect(screen.getAllByText("Gamma Solar")).toHaveLength(2);
    expect(screen.queryByText("Alpha Corp")).not.toBeInTheDocument();
  });

  it("opens the details dialog in view mode when a row is activated", () => {
    render(<ClientsTable clients={clients} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "View client details for Alpha Corp" })[0],
    );

    expect(screen.getByTestId("mock-dialog")).toHaveTextContent("Alpha Corp — view");
  });

  it("opens the details dialog in edit mode when the Edit button is used", () => {
    render(<ClientsTable clients={clients} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(screen.getByTestId("mock-dialog")).toHaveTextContent("Alpha Corp — edit");
  });

  it("clears the selected client when the dialog closes", () => {
    render(<ClientsTable clients={clients} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "View client details for Alpha Corp" })[0],
    );
    expect(screen.getByTestId("mock-dialog")).toBeInTheDocument();

    const lastCallProps = mockDialogProps.mock.calls.at(-1)![0] as {
      onOpenChange: (open: boolean) => void;
    };
    act(() => {
      lastCallProps.onOpenChange(false);
    });

    // No mock-dialog render call should now report an open state for this client.
    const latestOpenState = mockDialogProps.mock.calls.at(-1)![0] as { open: boolean };
    expect(latestOpenState.open).toBe(false);
  });
});
