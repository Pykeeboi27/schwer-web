import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  BeamTick,
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  StatProgress,
  StatusBadge,
  statusLabel,
} from "@/components/patterns";

describe("StatCard", () => {
  it("renders label, value, and optional footer", () => {
    render(
      <StatCard label="Revenue" value="₱1.2M" accent size="hero">
        <StatProgress percent={40} caption="40% of target" size="hero" />
      </StatCard>,
    );

    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("₱1.2M")).toBeInTheDocument();
    expect(screen.getByText("40% of target")).toBeInTheDocument();
  });

  it("renders the default (non-hero) tier without a footer", () => {
    render(<StatCard label="Clients" value={12} />);
    expect(screen.getByText("Clients")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

describe("StatProgress", () => {
  it("clamps the bar width to the 0–100 range", () => {
    const { container } = render(<StatProgress percent={150} />);
    const bar = container.querySelector<HTMLElement>('div[style*="width"]');
    expect(bar?.style.width).toBe("100%");
  });

  it("clamps negative percentages to zero", () => {
    const { container } = render(<StatProgress percent={-25} />);
    const bar = container.querySelector<HTMLElement>('div[style*="width"]');
    expect(bar?.style.width).toBe("0%");
  });
});

describe("StatusBadge / statusLabel", () => {
  it("resolves a known status to its registered label", () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("allows overriding the label and falls back to the raw key", () => {
    const { rerender } = render(
      <StatusBadge status="pending" label="Pending Approval" />,
    );
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();

    rerender(<StatusBadge status="mystery" tone="info" />);
    expect(screen.getByText("mystery")).toBeInTheDocument();
  });

  it("statusLabel returns the label or the key for unknown statuses", () => {
    expect(statusLabel("paid")).toBe("Paid");
    expect(statusLabel("unknown-status")).toBe("unknown-status");
  });
});

describe("EmptyState", () => {
  it("renders an icon, title, description, and actions", () => {
    render(
      <EmptyState icon={Search} title="No results" description="Try another search">
        <button>Clear</button>
      </EmptyState>,
    );

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText("Try another search")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders the title heading, description, and actions", () => {
    render(
      <PageHeader title="Sales" description="Overview" actions={<button>New</button>} />,
    );

    expect(screen.getByRole("heading", { name: "Sales" })).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});

describe("Panel", () => {
  it("renders a header when a title, description, or actions are provided", () => {
    render(
      <Panel title="Chart" description="Monthly" actions={<span>Filter</span>}>
        <p>body</p>
      </Panel>,
    );

    expect(screen.getByRole("heading", { name: "Chart" })).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("omits the header when no header content is given", () => {
    render(
      <Panel padded={false}>
        <p>only body</p>
      </Panel>,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("only body")).toBeInTheDocument();
  });
});

describe("Callout", () => {
  it("renders a titled tinted message", () => {
    render(
      <Callout tone="warning" title="Heads up">
        Something to note
      </Callout>,
    );

    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Something to note")).toBeInTheDocument();
  });
});

describe("BeamTick", () => {
  it("renders its children inline", () => {
    render(<BeamTick>Section</BeamTick>);
    expect(screen.getByText("Section")).toBeInTheDocument();
  });
});
