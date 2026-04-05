import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Branding", () => {
  it("renders Schwer Online Management on the public landing page", () => {
    render(<Home />);

    expect(screen.getAllByText("Schwer Online Management").length).toBeGreaterThan(0);
  });
});