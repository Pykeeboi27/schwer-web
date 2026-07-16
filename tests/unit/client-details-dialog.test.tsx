import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRefresh = vi.fn();
const mockUpdateClientAction = vi.fn();
const mockFetchClientContactsAction = vi.fn();
const mockAddClientContactAction = vi.fn();
const mockSetPrimaryContactAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/app/protected/sales/clients/actions", () => ({
  updateClientAction: (formData: FormData) => mockUpdateClientAction(formData),
}));

vi.mock("@/app/protected/sales/actions", () => ({
  fetchClientContactsAction: (clientId: string) =>
    mockFetchClientContactsAction(clientId),
  addClientContactAction: (formData: FormData) => mockAddClientContactAction(formData),
  setPrimaryContactAction: (formData: FormData) => mockSetPrimaryContactAction(formData),
}));

import { ClientDetailsDialog } from "@/components/dialogs/client-details-dialog";
import type { SalesClient, SalesClientContact } from "@/lib/sales/clients";

const client: SalesClient = {
  id: "c1",
  clientCode: "C123456",
  companyName: "Alpha Corp",
  sector: "commercial",
  paymentTermsDays: 30,
  contactPerson: "Juan Dela Cruz",
  email: "juan@alpha.com",
  phone: "0917 555 1234",
  address: "123 Main St, Manila",
  tin: "123-456-789-00000",
  birRegistrationLink: "https://drive.google.com/bir",
  notes: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const bareClient: SalesClient = {
  ...client,
  id: "c2",
  contactPerson: null,
  email: null,
  phone: null,
  address: null,
  tin: null,
  birRegistrationLink: null,
};

describe("ClientDetailsDialog", () => {
  beforeEach(() => {
    mockFetchClientContactsAction.mockReset();
    mockAddClientContactAction.mockReset();
    mockSetPrimaryContactAction.mockReset();
    mockFetchClientContactsAction.mockResolvedValue({
      ok: true,
      error: null,
      data: [] as SalesClientContact[],
    });
  });

  it("renders nothing when there is no selected client", () => {
    const { container } = render(
      <ClientDetailsDialog open={true} client={null} onOpenChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a read-only profile with real values and a BIR document link", () => {
    render(<ClientDetailsDialog open={true} client={client} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Alpha Corp")).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View document" })).toHaveAttribute(
      "href",
      "https://drive.google.com/bir",
    );
  });

  it("falls back to 'Not provided' for missing optional fields", () => {
    render(
      <ClientDetailsDialog open={true} client={bareClient} onOpenChange={vi.fn()} />,
    );

    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "View document" })).not.toBeInTheDocument();
  });

  it("switches to a pre-filled edit form and cancel reverts it", () => {
    render(<ClientDetailsDialog open={true} client={client} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Client" }));

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Alpha Corp");

    fireEvent.change(nameInput, { target: { value: "Changed Name" } });
    expect(nameInput.value).toBe("Changed Name");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Back to read-only view with the original name.
    expect(screen.getByText("Alpha Corp")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("submits the form, closes the dialog, and refreshes on success", async () => {
    mockUpdateClientAction.mockResolvedValue({ success: true, data: { id: "c1" } });
    const onOpenChange = vi.fn();

    render(
      <ClientDetailsDialog open={true} client={client} onOpenChange={onOpenChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Client" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    expect(mockUpdateClientAction).toHaveBeenCalledTimes(1);
    const submittedFormData = mockUpdateClientAction.mock.calls[0][0] as FormData;
    expect(submittedFormData.get("id")).toBe("c1");
    expect(submittedFormData.get("name")).toBe("Alpha Corp");
    expect(submittedFormData.get("sector")).toBe("commercial");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows form and field errors on failure without closing the dialog", async () => {
    mockUpdateClientAction.mockResolvedValue({
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: { name: "Client name is required." },
    });
    const onOpenChange = vi.fn();

    render(
      <ClientDetailsDialog open={true} client={client} onOpenChange={onOpenChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Client" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(
        screen.getByText("Please correct the highlighted fields."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Client name is required.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("starts directly in edit mode when startInEditMode is true", () => {
    render(
      <ClientDetailsDialog
        open={true}
        client={client}
        startInEditMode={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });

  it("loads and displays existing contacts, flagging the primary one", async () => {
    const contacts: SalesClientContact[] = [
      {
        id: "ct1",
        clientId: "c1",
        fullName: "Maria Santos",
        email: "maria@alpha.com",
        phone: null,
        mobile: "0917 000 0000",
        position: "Purchasing Manager",
        isPrimary: true,
      },
      {
        id: "ct2",
        clientId: "c1",
        fullName: "Jose Reyes",
        email: null,
        phone: null,
        mobile: null,
        position: null,
        isPrimary: false,
      },
    ];
    mockFetchClientContactsAction.mockResolvedValue({
      ok: true,
      error: null,
      data: contacts,
    });

    render(<ClientDetailsDialog open={true} client={client} onOpenChange={vi.fn()} />);

    await waitFor(() => expect(mockFetchClientContactsAction).toHaveBeenCalledWith("c1"));
    expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Jose Reyes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make Primary" })).toBeInTheDocument();
  });

  it("adds a new contact and reloads the contact list", async () => {
    mockAddClientContactAction.mockResolvedValue({ ok: true, error: null });

    render(<ClientDetailsDialog open={true} client={client} onOpenChange={vi.fn()} />);

    await waitFor(() => expect(mockFetchClientContactsAction).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Contact Name"), {
      target: { value: "Ana Cruz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Contact" }));

    await waitFor(() => expect(mockAddClientContactAction).toHaveBeenCalledTimes(1));
    const submitted = mockAddClientContactAction.mock.calls[0][0] as FormData;
    expect(submitted.get("clientId")).toBe("c1");
    expect(submitted.get("fullName")).toBe("Ana Cruz");
    await waitFor(() => expect(mockFetchClientContactsAction).toHaveBeenCalledTimes(2));
  });

  it("promotes a contact to primary", async () => {
    const contacts: SalesClientContact[] = [
      {
        id: "ct1",
        clientId: "c1",
        fullName: "Jose Reyes",
        email: null,
        phone: null,
        mobile: null,
        position: null,
        isPrimary: false,
      },
    ];
    mockFetchClientContactsAction.mockResolvedValue({
      ok: true,
      error: null,
      data: contacts,
    });
    mockSetPrimaryContactAction.mockResolvedValue({ ok: true, error: null });

    render(<ClientDetailsDialog open={true} client={client} onOpenChange={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Make Primary" }));

    await waitFor(() => expect(mockSetPrimaryContactAction).toHaveBeenCalledTimes(1));
    const submitted = mockSetPrimaryContactAction.mock.calls[0][0] as FormData;
    expect(submitted.get("clientId")).toBe("c1");
    expect(submitted.get("contactId")).toBe("ct1");
  });
});
