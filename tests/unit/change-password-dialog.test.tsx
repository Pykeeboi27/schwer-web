import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChangePasswordDialog } from "@/components/dialogs/change-password-dialog";
import { UserMenu } from "@/components/user-menu";

let mockActionState: { error: string | null; success: boolean } = {
  error: null,
  success: false,
};
let mockIsPending = false;

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: () => [mockActionState, vi.fn(), mockIsPending],
  };
});

describe("ChangePasswordDialog", () => {
  it("renders the three labelled password fields", () => {
    render(<ChangePasswordDialog open onOpenChange={vi.fn()} email="a@b.com" />);

    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("toggles each field's visibility independently", () => {
    render(<ChangePasswordDialog open onOpenChange={vi.fn()} email="a@b.com" />);

    const current = screen.getByLabelText("Current password") as HTMLInputElement;
    const next = screen.getByLabelText("New password") as HTMLInputElement;
    const confirm = screen.getByLabelText("Confirm new password") as HTMLInputElement;

    expect(current.type).toBe("password");
    expect(next.type).toBe("password");
    expect(confirm.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: /show current password/i }));

    expect(current.type).toBe("text");
    expect(next.type).toBe("password");
    expect(confirm.type).toBe("password");
  });

  it("shows the action's error message in an alert", () => {
    mockActionState = { error: "Current password is incorrect", success: false };

    render(<ChangePasswordDialog open onOpenChange={vi.fn()} email="a@b.com" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Current password is incorrect");

    mockActionState = { error: null, success: false };
  });

  it("disables submit while pending", () => {
    mockIsPending = true;

    render(<ChangePasswordDialog open onOpenChange={vi.fn()} email="a@b.com" />);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    mockIsPending = false;
  });

  it("closes when Cancel is clicked", () => {
    const onOpenChange = vi.fn();
    render(<ChangePasswordDialog open onOpenChange={onOpenChange} email="a@b.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("UserMenu change-password wiring", () => {
  it("opens the dialog from the account dropdown", async () => {
    const user = userEvent.setup();
    render(<UserMenu email="a@b.com" />);

    await user.click(screen.getByRole("button", { name: /a@b\.com|a$/i }));
    await user.click(await screen.findByText("Change password"));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Change password" })).toBeInTheDocument();
    });
  });
});
