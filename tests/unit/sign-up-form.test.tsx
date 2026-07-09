import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SignUpForm } from "@/components/sign-up-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: () => [{ error: null, success: false }, vi.fn(), false],
  };
});

describe("SignUpForm", () => {
  it("shows department options from enum list", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.click(screen.getByLabelText("Department"));

    expect(screen.getByRole("option", { name: "hr" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "engineering" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "executive" })).toBeInTheDocument();
  });

  it("toggles password and repeat password visibility", () => {
    render(<SignUpForm />);

    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const repeatPasswordInput = screen.getByLabelText(
      "Repeat password",
    ) as HTMLInputElement;

    const showPasswordButton = screen.getByRole("button", {
      name: /show password/i,
    });
    const showRepeatPasswordButton = screen.getByRole("button", {
      name: /show repeat password/i,
    });

    expect(passwordInput.type).toBe("password");
    expect(repeatPasswordInput.type).toBe("password");

    fireEvent.click(showPasswordButton);
    fireEvent.click(showRepeatPasswordButton);

    expect(passwordInput.type).toBe("text");
    expect(repeatPasswordInput.type).toBe("text");
  });
});
