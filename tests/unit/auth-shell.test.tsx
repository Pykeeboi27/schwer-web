import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthShell } from "@/components/auth/auth-shell";

describe("AuthShell", () => {
  it("renders the brand panel, back links, and children by default", () => {
    render(
      <AuthShell>
        <p>form content</p>
      </AuthShell>,
    );

    expect(screen.getByText("form content")).toBeInTheDocument();
    // Appears in both the desktop brand panel (h2) and the mobile strip (span).
    expect(screen.getAllByText("Schwer Online Management").length).toBeGreaterThan(0);
    // Two "Back to home" links: desktop panel + mobile column.
    expect(screen.getAllByText(/Back to home/)).toHaveLength(2);
  });

  it("hides the back links when showBackLink is false", () => {
    render(
      <AuthShell showBackLink={false}>
        <p>form content</p>
      </AuthShell>,
    );

    expect(screen.queryByText(/Back to home/)).not.toBeInTheDocument();
  });
});
