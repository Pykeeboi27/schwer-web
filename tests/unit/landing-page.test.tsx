import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Landing page", () => {
  it("shows login and sign up calls to action", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/auth/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/auth/sign-up");
  });
});