export interface TraceEntry {
  node: string;
  graph: string;
  summary: string;
  detail?: string;
}

export interface GraphNode {
  id: string;
  graph: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  graph: string;
  label?: string;
}

export interface GraphStructure {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface QueryResponseCompleted {
  thread_id: string;
  status: "completed";
  classification: string;
  trace: TraceEntry[];
  reply: string;
}

export interface QueryResponsePending {
  thread_id: string;
  status: "pending_approval";
  classification: string;
  trace: TraceEntry[];
  pending_action: string;
}

export type QueryResponse = QueryResponseCompleted | QueryResponsePending;
