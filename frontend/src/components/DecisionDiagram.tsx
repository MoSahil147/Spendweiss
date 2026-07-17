import { useMemo } from "react";
import { ReactFlow, Background, Position, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TraceEntry } from "../types";
import { buildTraceDiagram } from "../decisionPath";

interface DecisionDiagramProps {
  trace: TraceEntry[];
  query: string;
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
const DIAGRAM_HEIGHT = 480;
const MAX_COLUMNS = 6;
const NODE_GAP_X = 120;
const NODE_GAP_Y = 110;

function layout(
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>
): { positions: Map<string, { x: number; y: number }>; width: number; height: number } {
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, index) => {
    const column = index % MAX_COLUMNS;
    const row = Math.floor(index / MAX_COLUMNS);
    positions.set(node.id, {
      x: column * (NODE_WIDTH + NODE_GAP_X),
      y: row * (NODE_HEIGHT + NODE_GAP_Y),
    });
  });

  const maxColumn = Math.min(nodes.length, MAX_COLUMNS) - 1;
  const maxRow = Math.max(0, Math.floor((nodes.length - 1) / MAX_COLUMNS));
  const maxX = Math.max(0, maxColumn * (NODE_WIDTH + NODE_GAP_X));
  const maxY = Math.max(0, maxRow * (NODE_HEIGHT + NODE_GAP_Y));
  if (edges.length === 0) {
    return { positions, width: NODE_WIDTH, height: NODE_HEIGHT };
  }

  return { positions, width: maxX + NODE_WIDTH, height: maxY + NODE_HEIGHT };
}

export function DecisionDiagram({ trace, query }: DecisionDiagramProps) {
  const diagram = useMemo(() => buildTraceDiagram(trace), [trace]);
  const { positions, width: diagramWidth } = useMemo(() => layout(diagram.nodes, diagram.edges), [diagram]);
  const isDirectLookup = trace.length > 0 && trace.every((entry) => entry.graph === "direct");

  const nodes: Node[] = diagram.nodes.map((node) => ({
    id: node.id,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      label: (
        <div className="text-left">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-teal-deep">
            Step {Number(node.id.replace("step-", "")) + 1}
          </div>
          <div className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-ink">{node.name}</div>
        </div>
      ),
      detail: node.detail,
    },
    className: "diagram-node-visited",
    style: { width: NODE_WIDTH, height: NODE_HEIGHT },
  }));

  const edges: Edge[] = diagram.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "step",
    animated: true,
    label: edge.label,
    labelBgPadding: [6, 4],
    labelBgBorderRadius: 10,
    labelBgStyle: { fill: "rgba(245, 244, 239, 0.95)" },
    labelStyle: { fill: "#0c6b5e", fontWeight: 700, fontSize: 11 },
    className: "diagram-edge-visited",
  }));

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-raise shadow-card">
      <div className="border-b border-line bg-paper/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Question processed</p>
          {isDirectLookup && (
            <span className="rounded-full border border-gold/40 bg-gold-tint px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
              Direct data lookup, not an agent run
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink">{query}</p>
      </div>
      <div className="overflow-x-auto">
        <div style={{ height: Math.max(DIAGRAM_HEIGHT, Math.ceil(trace.length / MAX_COLUMNS) * (NODE_HEIGHT + NODE_GAP_Y) + 40), minWidth: Math.max(diagramWidth + 120, 760) }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.4}
            maxZoom={1.25}
          >
            <Background />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
