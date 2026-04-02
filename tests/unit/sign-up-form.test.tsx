import { fireEvent, render, screen } from "@testing-library/react";
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
  it("shows department options from enum list", () => {
    render(<SignUpForm />);

    const department = screen.getByLabelText("Department") as HTMLSelectElement;
    const options = Array.from(department.options).map((option) => option.value);

    expect(options).toContain("hr");
    expect(options).toContain("engineering");
    expect(options).toContain("executive");
  });

  it("toggles password and repeat password visibility", () => {
    render(<SignUpForm />);

    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const repeatPasswordInput = screen.getByLabelText("Repeat Password") as HTMLInputElement;

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
