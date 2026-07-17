import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnswerCard } from "./AnswerCard";
import type { QueryResponse } from "../types";

const completed: QueryResponse = {
  thread_id: "t1",
  status: "completed",
  classification: "card_optimizer",
  trace: [{ node: "respond", graph: "card_optimizer", summary: "respond: Use HDFC Millennia." }],
  reply: "Use HDFC Millennia.",
};

const directCompleted: QueryResponse = {
  thread_id: "t3",
  status: "completed",
  classification: "card_optimizer",
  trace: [
    { node: "query_router", graph: "direct", summary: "Routed the question to local data." },
    { node: "reward_lookup", graph: "direct", summary: "Compared reward rates for groceries." },
    { node: "recommendation", graph: "direct", summary: "Recommended HDFC Infinia Credit Card." },
  ],
  reply: "For this purchase, I would recommend HDFC Infinia Credit Card.",
};

const pending: QueryResponse = {
  thread_id: "t2",
  status: "pending_approval",
  classification: "card_optimizer",
  trace: [],
  pending_action: "This recommendation involves a purchase of ₹9000, above the ₹5000 threshold.",
};

describe("AnswerCard", () => {
  it("renders the query and the reply when completed", () => {
    render(<AnswerCard query="What card for groceries?" response={completed} onApprove={vi.fn()} onExpandDiagram={vi.fn()} />);
    expect(screen.getByText("What card for groceries?")).toBeInTheDocument();
    expect(screen.getByText("Use HDFC Millennia.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /see the flow and decision log/i })).toBeInTheDocument();
  });

  it("shows a numbered flow affordance when completed, and calls onExpandDiagram", () => {
    const onExpandDiagram = vi.fn();
    render(<AnswerCard query="q" response={completed} onApprove={vi.fn()} onExpandDiagram={onExpandDiagram} />);
    fireEvent.click(screen.getByText(/see the flow and decision log/i));
    expect(onExpandDiagram).toHaveBeenCalledWith(completed.trace);
  });

  it("shows the numbered flow when the answer was resolved directly from data", () => {
    render(<AnswerCard query="What card for groceries?" response={directCompleted} onApprove={vi.fn()} onExpandDiagram={vi.fn()} />);
    expect(screen.getByText("For this purchase, I would recommend HDFC Infinia Credit Card.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /see the flow and decision log/i })).toBeInTheDocument();
  });

  it("renders the pending action and approve/decline controls when pending", () => {
    render(<AnswerCard query="Book a flight" response={pending} onApprove={vi.fn()} onExpandDiagram={vi.fn()} />);
    expect(screen.getByText(pending.pending_action)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
  });

  it("calls onApprove with true/false when the approve/decline buttons are clicked", () => {
    const onApprove = vi.fn();
    render(<AnswerCard query="q" response={pending} onApprove={onApprove} onExpandDiagram={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: /decline/i }));
    expect(onApprove).toHaveBeenCalledWith(false);
  });
});
