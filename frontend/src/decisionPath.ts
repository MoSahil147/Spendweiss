import type { TraceEntry } from "./types";

export interface TraceDiagramNode {
  id: string;
  name: string;
  label: string;
  detail?: string;
}

export interface TraceDiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  // Index among edges sharing the same source/target pair (0 for the
  // first traversal, 1 for the second, ...). A loop that crosses the same
  // pair of nodes more than once (e.g. a critic REVISE sending reason
  // back to respond) gets one edge per traversal rather than one edge
  // with several step numbers crammed onto it, so each pass is its own
  // visible arrow. The renderer uses this to fan duplicate arrows apart
  // instead of drawing them directly on top of each other.
  occurrenceIndex: number;
}

export interface TraceDiagram {
  nodes: TraceDiagramNode[];
  edges: TraceDiagramEdge[];
}

export function edgeKey(source: string, target: string): string {
  return `${source}->${target}`;
}

export function selectTraceEntryForNode(nodeId: string, trace: TraceEntry[]): TraceEntry | null {
  const stepMatch = nodeId.match(/^step-(\d+)$/);
  if (stepMatch) {
    const index = Number(stepMatch[1]);
    return trace[index] ?? null;
  }

  const matches = trace.filter((entry) => entry.node === nodeId);
  if (matches.length === 0) return null;

  const prefix = `${nodeId}: `;
  const isThin = (summary: string) => {
    const content = summary.startsWith(prefix) ? summary.slice(prefix.length) : summary;
    return content.trim() === "" || content.trim() === "APPROVED";
  };

  const substantive = [...matches].reverse().find((entry) => !isThin(entry.summary));
  return substantive ?? matches[matches.length - 1] ?? null;
}

function traceLabel(entry: TraceEntry): string {
  const prefix = `${entry.node}: `;
  if (entry.summary.startsWith(prefix)) {
    return entry.summary.slice(prefix.length) || entry.node;
  }
  return entry.summary || entry.node;
}

export function buildTraceDiagram(trace: TraceEntry[]): TraceDiagram {
  const nodesById = new Map<string, TraceDiagramNode>();
  const edges: TraceDiagramEdge[] = [];

  trace.forEach((entry, index) => {
    const nodeId = `step-${index}`;
    if (!nodesById.has(nodeId)) {
      nodesById.set(nodeId, {
        id: nodeId,
        name: entry.node,
        label: traceLabel(entry),
        detail: entry.detail,
      });
    }

    if (index === 0) return;

    edges.push({
      id: edgeKey(`step-${index - 1}`, nodeId),
      source: `step-${index - 1}`,
      target: nodeId,
      label: String(index),
      occurrenceIndex: 0,
    });
  });

  return { nodes: [...nodesById.values()], edges };
}
