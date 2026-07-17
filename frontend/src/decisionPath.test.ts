import { describe, expect, it } from "vitest";
import { buildTraceDiagram, edgeKey, selectTraceEntryForNode } from "./decisionPath";
import type { TraceEntry } from "./types";

describe("buildTraceDiagram", () => {
  it("creates one diagram node per trace step", () => {
    const trace: TraceEntry[] = [
      { node: "reason", graph: "card_optimizer", summary: "reason: thinking" },
      { node: "respond", graph: "card_optimizer", summary: "respond: Use card X" },
      { node: "critic", graph: "card_optimizer", summary: "critic: APPROVED" },
    ];

    const diagram = buildTraceDiagram(trace);

    expect(diagram.nodes.map((node) => node.id)).toEqual(["step-0", "step-1", "step-2"]);
    expect(diagram.nodes.map((node) => node.name)).toEqual(["reason", "respond", "critic"]);
  });

  it("assigns increasing step numbers to each traversed edge in trace order", () => {
    const trace: TraceEntry[] = [
      { node: "reason", graph: "card_optimizer", summary: "" },
      { node: "respond", graph: "card_optimizer", summary: "" },
    ];

    const diagram = buildTraceDiagram(trace);

    const edge = diagram.edges.find((candidate) => candidate.source === "step-0" && candidate.target === "step-1");
    expect(edge?.label).toBe("1");
    expect(edge?.occurrenceIndex).toBe(0);
  });

  it("keeps repeated trace entries in order as a straight timeline", () => {
    const trace: TraceEntry[] = [
      { node: "reason", graph: "card_optimizer", summary: "" },
      { node: "respond", graph: "card_optimizer", summary: "" },
      { node: "critic", graph: "card_optimizer", summary: "critic: REVISE: missed a better offer" },
      { node: "reason", graph: "card_optimizer", summary: "" },
      { node: "respond", graph: "card_optimizer", summary: "" },
      { node: "critic", graph: "card_optimizer", summary: "critic: APPROVED" },
    ];

    const diagram = buildTraceDiagram(trace);

    expect(diagram.nodes.map((node) => node.id)).toEqual([
      "step-0",
      "step-1",
      "step-2",
      "step-3",
      "step-4",
      "step-5",
    ]);
    expect(diagram.edges.map((edge) => edge.source)).toEqual(["step-0", "step-1", "step-2", "step-3", "step-4"]);
    expect(diagram.edges.map((edge) => edge.target)).toEqual(["step-1", "step-2", "step-3", "step-4", "step-5"]);
  });

  it("records consecutive entries as separate steps so the timeline stays complete", () => {
    const trace: TraceEntry[] = [
      { node: "call_tool", graph: "card_optimizer", summary: "call_tool: requested check_offers({})" },
      { node: "call_tool", graph: "card_optimizer", summary: "call_tool: check_offers returned HDFC" },
      { node: "reason", graph: "card_optimizer", summary: "" },
    ];

    const diagram = buildTraceDiagram(trace);

    expect(diagram.edges.some((edge) => edge.source === "step-0" && edge.target === "step-1")).toBe(true);
    expect(diagram.edges.some((edge) => edge.source === "step-1" && edge.target === "step-2")).toBe(true);
  });

  it("returns an empty diagram for an empty trace", () => {
    const diagram = buildTraceDiagram([]);
    expect(diagram.nodes).toEqual([]);
    expect(diagram.edges).toEqual([]);
  });

  it("keeps the first non-empty detail seen for a repeated node", () => {
    const trace: TraceEntry[] = [
      { node: "model", graph: "subscription_hunter", summary: "model: ", detail: "Requested tool call(s): find_recurring_charges_tool({})" },
      { node: "model", graph: "subscription_hunter", summary: "model: I found recurring charges." },
    ];

    const diagram = buildTraceDiagram(trace);

    const modelNode = diagram.nodes.find((node) => node.id === "step-0");
    expect(modelNode?.detail).toBe("Requested tool call(s): find_recurring_charges_tool({})");
  });
});

describe("selectTraceEntryForNode", () => {
  it("picks the most substantive trace entry for a repeated node", () => {
    const trace: TraceEntry[] = [
      { node: "model", graph: "subscription_hunter", summary: "model: " },
      { node: "model", graph: "subscription_hunter", summary: "model: I found recurring charges." },
    ];

    expect(selectTraceEntryForNode("model", trace)?.summary).toBe("model: I found recurring charges.");
  });

  it("prefers a REVISE critique over a bare APPROVED verdict, even though APPROVED is last", () => {
    const trace: TraceEntry[] = [
      { node: "critic", graph: "card_optimizer", summary: "critic: REVISE: missed a better offer" },
      { node: "critic", graph: "card_optimizer", summary: "critic: APPROVED" },
    ];

    expect(selectTraceEntryForNode("critic", trace)?.summary).toBe("critic: REVISE: missed a better offer");
  });

  it("returns null when the node never appears in the trace", () => {
    const trace: TraceEntry[] = [{ node: "reason", graph: "card_optimizer", summary: "" }];
    expect(selectTraceEntryForNode("critic", trace)).toBeNull();
  });
});

describe("edgeKey", () => {
  it("joins source and target with an arrow", () => {
    expect(edgeKey("a", "b")).toBe("a->b");
  });
});
