import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHero } from "./page-hero";
import { EmptyState } from "./states";
import { DecisionPill, ProvenancePill } from "./primitives";

describe("PageHero", () => {
  it("renders kicker, title and subline", () => {
    render(<PageHero kicker="Traceable by design" title="Meetings" sub="3 meetings" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Meetings");
    expect(screen.getByText("Traceable by design")).toBeInTheDocument();
    expect(screen.getByText(/3 meetings/)).toBeInTheDocument();
  });
});

describe("DecisionPill", () => {
  it("renders formal labels, never raw constants", () => {
    const { rerender } = render(<DecisionPill status="DETECTED" />);
    expect(screen.getByText("Detected")).toBeInTheDocument();
    expect(screen.queryByText("DETECTED")).not.toBeInTheDocument();
    rerender(<DecisionPill status="CONFIRMED" />);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });
});

describe("ProvenancePill", () => {
  it("renders formal provenance, never raw constants", () => {
    render(<ProvenancePill value="HUMAN_APPROVED" />);
    expect(screen.getByText("Human approved")).toBeInTheDocument();
    expect(screen.queryByText("HUMAN_APPROVED")).not.toBeInTheDocument();
  });
});
describe("EmptyState", () => {
  it("renders title, body and action", () => {
    render(
      <EmptyState
        title="No meetings yet"
        body="Create your first meeting."
        action={<button>New meeting</button>}
      />
    );
    expect(screen.getByText("No meetings yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first meeting.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New meeting" })).toBeInTheDocument();
  });
});
