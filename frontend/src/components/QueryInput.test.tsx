import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryInput } from "./QueryInput";

describe("QueryInput", () => {
  it("shows a few example prompts to guide the user", () => {
    render(<QueryInput onSubmit={vi.fn()} disabled={false} />);

    expect(screen.getByText(/try:/i)).toBeInTheDocument();
    expect(screen.getByText(/what card should i use for groceries\?/i)).toBeInTheDocument();
    expect(screen.getByText(/is my netflix bill actually a subscription\?/i)).toBeInTheDocument();
  });
});
