import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginForm, getLoginErrorMessage } from "@/components/login-form";

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

describe("LoginForm", () => {
  it("toggles password visibility", () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: /show password/i });

    expect(passwordInput.type).toBe("password");
    fireEvent.click(toggle);
    expect(passwordInput.type).toBe("text");
    fireEvent.click(toggle);
    expect(passwordInput.type).toBe("password");
  });

  it("maps unconfirmed email error to actionable copy", () => {
    expect(getLoginErrorMessage("Email not confirmed")).toContain(
      "Please confirm your email",
    );
  });
});
