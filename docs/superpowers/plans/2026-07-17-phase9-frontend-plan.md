# Phase 9: Frontend Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SpendWeiss website: a chat-first React app that shows each answer alongside an on-demand, custom-rendered diagram of the actual decision path the multi-agent graph took, with per-node reasoning on click.

**Architecture:** A single-page React app (`frontend/`) talks to Phase 8's FastAPI backend over three calls (`GET /graph/structure`, `POST /query`, `POST /approve/{thread_id}`). Path-highlighting for the diagram is pure data transformation (structure + trace → which nodes/edges are "on" for this answer), kept separate from the React Flow rendering component so it's unit-testable without a browser. Visual design is built in two passes: functional/structural first, then a dedicated design pass using the `frontend-design` skill.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Flow (`@xyflow/react`) + `dagre` for auto-layout, Vitest + React Testing Library for tests. Backend: FastAPI's `CORSMiddleware` (already a transitive dependency via `fastapi[standard]`, part of `starlette`).

## Global Constraints

- Frontend lives at top-level `frontend/`, sibling to `backend/` — not nested inside it (per spec).
- No authentication, no persistence beyond the browser tab's lifetime — `thread_id` lives in React state only.
- No use of LangGraph's `draw_mermaid()`/Mermaid rendering anywhere in the UI — diagram is custom-rendered from `/graph/structure`'s JSON via React Flow.
- Desktop-first, no mobile-specific layout pass.
- Chat-first layout: diagram is revealed per-answer via a "See how this was decided" affordance, not a permanent side panel.
- The site must not read as generically AI-generated/templated ("vibecoded") — a deliberate, non-default Tailwind theme is required, built via the `frontend-design` skill in Task 5, not left as Tailwind's default palette/shapes.
- Backend response shapes (from `backend/phase8_api/app.py`, already implemented, do not change): `/query` and `/approve/{thread_id}` both return either `{thread_id, status: "completed", classification, trace, reply}` or `{thread_id, status: "pending_approval", classification, trace, pending_action}`. `trace` is `Array<{node: string, graph: string, summary: string}>`. `/graph/structure` returns `{nodes: Array<{id: string, graph: string}>, edges: Array<{source: string, target: string, graph: string, label?: string}>}`.

---

## File Structure

```
backend/
  phase8_api/
    app.py                        # MODIFY: add CORSMiddleware
frontend/
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  index.html
  .env.example                    # VITE_API_BASE_URL
  vitest.setup.ts
  src/
    main.tsx
    App.tsx                       # conversation thread, thread_id state
    api.ts                        # typed fetch client
    api.test.ts
    types.ts                      # shared response/trace types
    decisionPath.ts                # pure highlighting logic
    decisionPath.test.ts
    components/
      QueryInput.tsx
      AnswerCard.tsx
      AnswerCard.test.tsx
      DecisionDiagram.tsx
      NodeDetailPanel.tsx
    index.css                     # Tailwind directives + design tokens
```

---

### Task 1: CORS middleware on the backend

**Files:**
- Modify: `backend/phase8_api/app.py`
- Test: `backend/tests/test_phase8_api.py`

**Interfaces:**
- Produces: `app` (the existing FastAPI instance) now accepts cross-origin requests from `http://localhost:5173` (Vite's default dev port) and `http://127.0.0.1:5173`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_phase8_api.py`:
```python
def test_cors_allows_vite_dev_origin():
    response = client.options(
        "/query",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `uv run pytest tests/test_phase8_api.py -k cors -v`
Expected: FAIL — no CORS headers present, `KeyError: 'access-control-allow-origin'`.

- [ ] **Step 3: Add CORSMiddleware**

In `backend/phase8_api/app.py`, add the import and middleware registration right after `app = FastAPI(title="SpendWeiss API")`:
```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SpendWeiss API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
(Place this immediately after the `app = FastAPI(...)` line, before the route definitions.)

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_phase8_api.py -k cors -v`
Expected: 1 passed.

- [ ] **Step 5: Run the full backend suite**

Run: `uv run pytest -q`
Expected: all tests pass (59 total).

- [ ] **Step 6: Commit**

```bash
git add backend/phase8_api/app.py backend/tests/test_phase8_api.py
git commit -m "phase9: allow CORS from the Vite dev origin"
```

---

### Task 2: Scaffold the frontend project and typed API client

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.ts`, `frontend/postcss.config.js`, `frontend/index.html`, `frontend/.env.example`, `frontend/vitest.setup.ts`
- Create: `frontend/src/main.tsx`, `frontend/src/types.ts`, `frontend/src/api.ts`, `frontend/src/index.css`
- Test: `frontend/src/api.test.ts`

**Interfaces:**
- Produces (in `frontend/src/types.ts`):
  ```typescript
  export interface TraceEntry { node: string; graph: string; summary: string; }
  export interface GraphNode { id: string; graph: string; }
  export interface GraphEdge { source: string; target: string; graph: string; label?: string; }
  export interface GraphStructure { nodes: GraphNode[]; edges: GraphEdge[]; }
  export interface QueryResponseCompleted { thread_id: string; status: "completed"; classification: string; trace: TraceEntry[]; reply: string; }
  export interface QueryResponsePending { thread_id: string; status: "pending_approval"; classification: string; trace: TraceEntry[]; pending_action: string; }
  export type QueryResponse = QueryResponseCompleted | QueryResponsePending;
  ```
- Produces (in `frontend/src/api.ts`): `fetchGraphStructure(): Promise<GraphStructure>`, `postQuery(message: string, threadId?: string): Promise<QueryResponse>`, `postApprove(threadId: string, approved: boolean): Promise<QueryResponse>`.

- [ ] **Step 1: Scaffold the Vite project**

From the repo root:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```
Expected: `frontend/` now contains a working Vite React+TS scaffold (`package.json`, `src/main.tsx`, `src/App.tsx`, etc.). Delete the scaffold's default `src/App.css` and default counter markup from `src/App.tsx` — Task 4 replaces `App.tsx` entirely.

- [ ] **Step 2: Install Tailwind, React Flow, dagre, and test tooling**

From `frontend/`:
```bash
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
npm install @xyflow/react dagre
npm install -D @types/dagre
npx tailwindcss init -p
```
Expected: `tailwindcss`, `@xyflow/react`, `dagre`, and the test packages appear in `package.json`; `tailwind.config.js`/`postcss.config.js` are generated (rename `tailwind.config.js` to `frontend/tailwind.config.ts` in the next step, converting to a typed export).

- [ ] **Step 3: Configure Tailwind**

Replace the generated `frontend/tailwind.config.js` with `frontend/tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```
(Task 5 fills in `theme.extend` with the real design system — this task only wires the pipeline.)

Replace `frontend/src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Confirm `frontend/src/main.tsx` imports it:
```typescript
import "./index.css";
```

- [ ] **Step 4: Configure Vitest**

Create `frontend/vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `frontend/vite.config.ts` (merge into the existing exported config, don't replace the `plugins: [react()]` line):
```typescript
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
});
```

Add a `"test": "vitest run"` entry to `frontend/package.json`'s `"scripts"`.

- [ ] **Step 5: Create `.env.example` and confirm the dev server boots**

Create `frontend/.env.example`:
```
VITE_API_BASE_URL=http://localhost:8000
```

Run: `npm run dev` (from `frontend/`), then in another terminal: `curl -sI http://localhost:5173 | head -1`
Expected: `HTTP/1.1 200 OK`. Stop the dev server after confirming (Ctrl+C).

- [ ] **Step 6: Write `types.ts`**

Create `frontend/src/types.ts` with the exact interfaces from this task's **Interfaces** block above.

- [ ] **Step 7: Write the failing test for `api.ts`**

Create `frontend/src/api.test.ts`:
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchGraphStructure, postQuery, postApprove } from "./api";

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetchGraphStructure calls GET /graph/structure and returns parsed JSON", async () => {
    const fakeStructure = { nodes: [{ id: "reason", graph: "card_optimizer" }], edges: [] };
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeStructure });

    const result = await fetchGraphStructure();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/graph/structure"));
    expect(result).toEqual(fakeStructure);
  });

  it("postQuery sends message and thread_id, returns parsed JSON", async () => {
    const fakeResponse = { thread_id: "abc", status: "completed", classification: "card_optimizer", trace: [], reply: "Use HDFC Millennia." };
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeResponse });

    const result = await postQuery("What card for groceries?", "abc");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/query"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "What card for groceries?", thread_id: "abc" }),
      })
    );
    expect(result).toEqual(fakeResponse);
  });

  it("postQuery omits thread_id as null when not provided", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });

    await postQuery("hi");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/query"),
      expect.objectContaining({ body: JSON.stringify({ message: "hi", thread_id: null }) })
    );
  });

  it("postApprove sends approved flag to /approve/{thread_id}", async () => {
    const fakeResponse = { thread_id: "abc", status: "completed", classification: "card_optimizer", trace: [], reply: "Approved." };
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeResponse });

    const result = await postApprove("abc", true);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/approve/abc"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ approved: true }) })
    );
    expect(result).toEqual(fakeResponse);
  });

  it("throws a descriptive error when the response is not ok", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 404 });

    await expect(postApprove("unknown-thread", true)).rejects.toThrow("404");
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run (from `frontend/`): `npm run test`
Expected: FAIL — `Error: Cannot find module './api'` (file doesn't exist yet).

- [ ] **Step 9: Implement `api.ts`**

Create `frontend/src/api.ts`:
```typescript
import type { GraphStructure, QueryResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function parseOrThrow<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchGraphStructure(): Promise<GraphStructure> {
  const response = await fetch(`${API_BASE_URL}/graph/structure`);
  return parseOrThrow<GraphStructure>(response, "fetchGraphStructure");
}

export async function postQuery(message: string, threadId?: string): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, thread_id: threadId ?? null }),
  });
  return parseOrThrow<QueryResponse>(response, "postQuery");
}

export async function postApprove(threadId: string, approved: boolean): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/approve/${threadId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved }),
  });
  return parseOrThrow<QueryResponse>(response, "postApprove");
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm run test`
Expected: 5 passed.

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "phase9: scaffold frontend project with typed API client"
```

---

### Task 3: Decision-path highlighting logic (pure, no rendering)

**Files:**
- Create: `frontend/src/decisionPath.ts`
- Test: `frontend/src/decisionPath.test.ts`

**Interfaces:**
- Consumes: `GraphStructure`, `TraceEntry` from `./types` (Task 2).
- Produces:
  ```typescript
  export interface HighlightedPath {
    visitedNodeIds: Set<string>;
    visitedEdgeKeys: Set<string>;
    orderByNodeId: Map<string, number>;
  }
  export function computeHighlightedPath(structure: GraphStructure, trace: TraceEntry[]): HighlightedPath;
  export function edgeKey(source: string, target: string): string; // `${source}->${target}`
  ```
  `DecisionDiagram` (Task 4) consumes `HighlightedPath` to decide which React Flow nodes/edges get the "on path" visual treatment, and `orderByNodeId` to label step numbers.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/decisionPath.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { computeHighlightedPath, edgeKey } from "./decisionPath";
import type { GraphStructure, TraceEntry } from "./types";

const structure: GraphStructure = {
  nodes: [
    { id: "dispatch_node", graph: "outer" },
    { id: "approval_gate", graph: "outer" },
    { id: "retrieve_memory", graph: "card_optimizer" },
    { id: "reason", graph: "card_optimizer" },
    { id: "call_tool", graph: "card_optimizer" },
    { id: "respond", graph: "card_optimizer" },
    { id: "critic", graph: "card_optimizer" },
    { id: "model", graph: "subscription_hunter" },
    { id: "tools", graph: "subscription_hunter" },
  ],
  edges: [
    { source: "dispatch_node", target: "approval_gate", graph: "outer" },
    { source: "retrieve_memory", target: "reason", graph: "card_optimizer" },
    { source: "reason", target: "call_tool", graph: "card_optimizer" },
    { source: "call_tool", target: "reason", graph: "card_optimizer" },
    { source: "reason", target: "respond", graph: "card_optimizer" },
    { source: "respond", target: "critic", graph: "card_optimizer" },
    { source: "critic", target: "reason", graph: "card_optimizer" },
    { source: "model", target: "tools", graph: "subscription_hunter" },
    { source: "tools", target: "model", graph: "subscription_hunter" },
    { source: "dispatch_node", target: "reason", graph: "fan_out" },
    { source: "dispatch_node", target: "model", graph: "fan_out" },
  ],
};

describe("computeHighlightedPath", () => {
  it("marks every trace node as visited, plus dispatch_node unconditionally", () => {
    const trace: TraceEntry[] = [
      { node: "reason", graph: "card_optimizer", summary: "reason: thinking" },
      { node: "respond", graph: "card_optimizer", summary: "respond: Use card X" },
      { node: "critic", graph: "card_optimizer", summary: "critic: APPROVED" },
      { node: "approval_gate", graph: "outer", summary: "approval_gate: no approval needed" },
    ];

    const path = computeHighlightedPath(structure, trace);

    expect(path.visitedNodeIds).toEqual(
      new Set(["dispatch_node", "reason", "respond", "critic", "approval_gate"])
    );
  });

  it("assigns increasing order to each trace node in trace order", () => {
    const trace: TraceEntry[] = [
      { node: "reason", graph: "card_optimizer", summary: "" },
      { node: "respond", graph: "card_optimizer", summary: "" },
    ];

    const path = computeHighlightedPath(structure, trace);

    expect(path.orderByNodeId.get("reason")).toBe(0);
    expect(path.orderByNodeId.get("respond")).toBe(1);
  });

  it("highlights the fan-out edge into the graph the trace actually used", () => {
    const cardTrace: TraceEntry[] = [{ node: "reason", graph: "card_optimizer", summary: "" }];
    const subTrace: TraceEntry[] = [{ node: "model", graph: "subscription_hunter", summary: "" }];

    expect(computeHighlightedPath(structure, cardTrace).visitedEdgeKeys.has(edgeKey("dispatch_node", "reason"))).toBe(true);
    expect(computeHighlightedPath(structure, cardTrace).visitedEdgeKeys.has(edgeKey("dispatch_node", "model"))).toBe(false);
    expect(computeHighlightedPath(structure, subTrace).visitedEdgeKeys.has(edgeKey("dispatch_node", "model"))).toBe(true);
  });

  it("highlights the critic-to-reason loop-back edge when a revision happened", () => {
    const trace: TraceEntry[] = [
      { node: "reason", graph: "card_optimizer", summary: "" },
      { node: "respond", graph: "card_optimizer", summary: "" },
      { node: "critic", graph: "card_optimizer", summary: "critic: REVISE" },
      { node: "reason", graph: "card_optimizer", summary: "" },
      { node: "respond", graph: "card_optimizer", summary: "" },
      { node: "critic", graph: "card_optimizer", summary: "critic: APPROVED" },
    ];

    const path = computeHighlightedPath(structure, trace);

    expect(path.visitedEdgeKeys.has(edgeKey("critic", "reason"))).toBe(true);
    expect(path.orderByNodeId.get("reason")).toBe(0);
  });

  it("returns an empty highlighted path for an empty trace, except dispatch_node", () => {
    const path = computeHighlightedPath(structure, []);
    expect(path.visitedNodeIds).toEqual(new Set(["dispatch_node"]));
    expect(path.visitedEdgeKeys.size).toBe(0);
  });
});

describe("edgeKey", () => {
  it("joins source and target with an arrow", () => {
    expect(edgeKey("a", "b")).toBe("a->b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module './decisionPath'`.

- [ ] **Step 3: Implement `decisionPath.ts`**

Create `frontend/src/decisionPath.ts`:
```typescript
import type { GraphStructure, TraceEntry } from "./types";

export interface HighlightedPath {
  visitedNodeIds: Set<string>;
  visitedEdgeKeys: Set<string>;
  orderByNodeId: Map<string, number>;
}

export function edgeKey(source: string, target: string): string {
  return `${source}->${target}`;
}

// dispatch_node is never itself a trace entry (phase8_api's trace only
// records dispatch()'s inner steps plus approval_gate's own entry), but
// every query passes through it structurally, so it's always marked
// visited when there's anything to show at all.
const DISPATCH_NODE_ID = "dispatch_node";

export function computeHighlightedPath(structure: GraphStructure, trace: TraceEntry[]): HighlightedPath {
  const visitedNodeIds = new Set<string>();
  const orderByNodeId = new Map<string, number>();

  if (trace.length > 0) {
    visitedNodeIds.add(DISPATCH_NODE_ID);
  }

  trace.forEach((entry, index) => {
    visitedNodeIds.add(entry.node);
    if (!orderByNodeId.has(entry.node)) {
      orderByNodeId.set(entry.node, index);
    }
  });

  const visitedEdgeKeys = new Set<string>();
  for (const edge of structure.edges) {
    if (!visitedNodeIds.has(edge.source) || !visitedNodeIds.has(edge.target)) {
      continue;
    }
    if (edge.graph === "fan_out") {
      // Only the fan-out edge into the graph this trace actually used.
      const usedGraph = trace.find((entry) => entry.node === edge.target)?.graph;
      if (usedGraph === undefined) continue;
    }
    visitedEdgeKeys.add(edgeKey(edge.source, edge.target));
  }

  return { visitedNodeIds, visitedEdgeKeys, orderByNodeId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: all `decisionPath.test.ts` tests pass (5 in this file, 10 total including `api.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/decisionPath.ts frontend/src/decisionPath.test.ts
git commit -m "phase9: add pure decision-path highlighting logic"
```

---

### Task 4: UI components — QueryInput, AnswerCard, DecisionDiagram, NodeDetailPanel, App

**Files:**
- Create: `frontend/src/components/QueryInput.tsx`
- Create: `frontend/src/components/AnswerCard.tsx`
- Test: `frontend/src/components/AnswerCard.test.tsx`
- Create: `frontend/src/components/DecisionDiagram.tsx`
- Create: `frontend/src/components/NodeDetailPanel.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `postQuery`, `postApprove`, `fetchGraphStructure` (Task 2); `computeHighlightedPath`, `edgeKey` (Task 3); `QueryResponse`, `GraphStructure`, `TraceEntry` (Task 2).
- Produces: `<App />` — the full page. No later task consumes these directly (this is the top of the tree), but Task 5 restyles all of them.

- [ ] **Step 1: `QueryInput`**

Create `frontend/src/components/QueryInput.tsx`:
```typescript
import { useState, type FormEvent } from "react";

interface QueryInputProps {
  onSubmit: (message: string) => void;
  disabled: boolean;
}

export function QueryInput({ onSubmit, disabled }: QueryInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        placeholder="Ask about a purchase or your subscriptions..."
        className="flex-1 rounded border px-3 py-2"
      />
      <button type="submit" disabled={disabled} className="rounded px-4 py-2 border">
        Send
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write the failing test for `AnswerCard`**

Create `frontend/src/components/AnswerCard.test.tsx`:
```typescript
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
  });

  it("shows a 'see how this was decided' affordance when completed, and calls onExpandDiagram", () => {
    const onExpandDiagram = vi.fn();
    render(<AnswerCard query="q" response={completed} onApprove={vi.fn()} onExpandDiagram={onExpandDiagram} />);
    fireEvent.click(screen.getByText(/see how this was decided/i));
    expect(onExpandDiagram).toHaveBeenCalledWith(completed.trace);
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module './AnswerCard'`.

- [ ] **Step 4: Implement `AnswerCard`**

Create `frontend/src/components/AnswerCard.tsx`:
```typescript
import type { QueryResponse, TraceEntry } from "../types";

interface AnswerCardProps {
  query: string;
  response: QueryResponse;
  onApprove: (approved: boolean) => void;
  onExpandDiagram: (trace: TraceEntry[]) => void;
}

export function AnswerCard({ query, response, onApprove, onExpandDiagram }: AnswerCardProps) {
  return (
    <div className="rounded border p-4 space-y-2">
      <p className="font-medium">{query}</p>

      {response.status === "completed" && (
        <>
          <p>{response.reply}</p>
          <button
            type="button"
            onClick={() => onExpandDiagram(response.trace)}
            className="text-sm underline"
          >
            See how this was decided
          </button>
        </>
      )}

      {response.status === "pending_approval" && (
        <>
          <p>{response.pending_action}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => onApprove(true)} className="rounded px-3 py-1 border">
              Approve
            </button>
            <button type="button" onClick={() => onApprove(false)} className="rounded px-3 py-1 border">
              Decline
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test`
Expected: all `AnswerCard.test.tsx` tests pass.

- [ ] **Step 6: `DecisionDiagram`**

Create `frontend/src/components/DecisionDiagram.tsx`:
```typescript
import { useMemo } from "react";
import { ReactFlow, Background, type Node, type Edge } from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import type { GraphStructure, TraceEntry } from "../types";
import { computeHighlightedPath, edgeKey } from "../decisionPath";

interface DecisionDiagramProps {
  structure: GraphStructure;
  trace: TraceEntry[];
  onSelectNode: (node: TraceEntry | null) => void;
}

function layout(structure: GraphStructure): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100 });

  for (const node of structure.nodes) {
    graph.setNode(node.id, { width: 140, height: 48 });
  }
  for (const edge of structure.edges) {
    graph.setEdge(edge.source, edge.target);
  }
  dagre.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of structure.nodes) {
    const { x, y } = graph.node(node.id);
    positions.set(node.id, { x, y });
  }
  return positions;
}

export function DecisionDiagram({ structure, trace, onSelectNode }: DecisionDiagramProps) {
  const highlighted = useMemo(() => computeHighlightedPath(structure, trace), [structure, trace]);
  const positions = useMemo(() => layout(structure), [structure]);

  const nodes: Node[] = structure.nodes.map((node) => ({
    id: node.id,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: { label: node.id },
    className: highlighted.visitedNodeIds.has(node.id) ? "diagram-node-visited" : "diagram-node-dimmed",
  }));

  const edges: Edge[] = structure.edges.map((edge) => ({
    id: edgeKey(edge.source, edge.target),
    source: edge.source,
    target: edge.target,
    animated: highlighted.visitedEdgeKeys.has(edgeKey(edge.source, edge.target)),
    className: highlighted.visitedEdgeKeys.has(edgeKey(edge.source, edge.target))
      ? "diagram-edge-visited"
      : "diagram-edge-dimmed",
  }));

  function handleNodeClick(_: unknown, node: Node) {
    if (!highlighted.visitedNodeIds.has(node.id)) return;
    const traceEntry = trace.find((entry) => entry.node === node.id) ?? null;
    onSelectNode(traceEntry);
  }

  return (
    <div style={{ height: 320 }} className="rounded border">
      <ReactFlow nodes={nodes} edges={edges} onNodeClick={handleNodeClick} fitView>
        <Background />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 7: `NodeDetailPanel`**

Create `frontend/src/components/NodeDetailPanel.tsx`:
```typescript
import type { TraceEntry } from "../types";

interface NodeDetailPanelProps {
  entry: TraceEntry | null;
  onClose: () => void;
}

export function NodeDetailPanel({ entry, onClose }: NodeDetailPanelProps) {
  if (!entry) return null;

  return (
    <div className="rounded border p-3 mt-2">
      <div className="flex justify-between items-start">
        <p className="font-medium">{entry.node}</p>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="text-sm mt-1">{entry.summary}</p>
    </div>
  );
}
```

- [ ] **Step 8: `App`**

Replace `frontend/src/App.tsx`:
```typescript
import { useEffect, useState } from "react";
import { fetchGraphStructure, postApprove, postQuery } from "./api";
import { QueryInput } from "./components/QueryInput";
import { AnswerCard } from "./components/AnswerCard";
import { DecisionDiagram } from "./components/DecisionDiagram";
import { NodeDetailPanel } from "./components/NodeDetailPanel";
import type { GraphStructure, QueryResponse, TraceEntry } from "./types";

interface ConversationEntry {
  query: string;
  response: QueryResponse;
  expandedTrace: TraceEntry[] | null;
  selectedNode: TraceEntry | null;
}

function App() {
  const [structure, setStructure] = useState<GraphStructure | null>(null);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetchGraphStructure().then(setStructure);
  }, []);

  async function handleSubmit(message: string) {
    setPending(true);
    const response = await postQuery(message, threadId);
    setThreadId(response.thread_id);
    setEntries((prev) => [...prev, { query: message, response, expandedTrace: null, selectedNode: null }]);
    setPending(false);
  }

  async function handleApprove(index: number, approved: boolean) {
    const entry = entries[index];
    if (entry.response.status !== "pending_approval") return;
    const response = await postApprove(entry.response.thread_id, approved);
    setEntries((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, response } : item)));
  }

  function handleExpandDiagram(index: number, trace: TraceEntry[]) {
    setEntries((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, expandedTrace: trace, selectedNode: null } : item))
    );
  }

  function handleSelectNode(index: number, node: TraceEntry | null) {
    setEntries((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, selectedNode: node } : item)));
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">SpendWeiss</h1>

      {entries.map((entry, index) => (
        <div key={index}>
          <AnswerCard
            query={entry.query}
            response={entry.response}
            onApprove={(approved) => handleApprove(index, approved)}
            onExpandDiagram={(trace) => handleExpandDiagram(index, trace)}
          />
          {entry.expandedTrace && structure && (
            <>
              <DecisionDiagram
                structure={structure}
                trace={entry.expandedTrace}
                onSelectNode={(node) => handleSelectNode(index, node)}
              />
              <NodeDetailPanel entry={entry.selectedNode} onClose={() => handleSelectNode(index, null)} />
            </>
          )}
        </div>
      ))}

      <QueryInput onSubmit={handleSubmit} disabled={pending || !structure} />
    </div>
  );
}

export default App;
```

- [ ] **Step 9: Run the full frontend test suite**

Run: `npm run test`
Expected: all tests pass (`api.test.ts`, `decisionPath.test.ts`, `AnswerCard.test.tsx`).

- [ ] **Step 10: Type-check and build**

Run: `npm run build`
Expected: builds successfully with no TypeScript errors. If React Flow's types conflict with the installed React version, resolve by checking `@xyflow/react`'s peer dependency range against the installed `react`/`react-dom` versions in `package.json` and aligning them — do not suppress with `// @ts-ignore`.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/
git commit -m "phase9: add QueryInput, AnswerCard, DecisionDiagram, NodeDetailPanel, wire up App"
```

---

### Task 5: Design pass — real visual identity

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/QueryInput.tsx`, `frontend/src/components/AnswerCard.tsx`, `frontend/src/components/DecisionDiagram.tsx`, `frontend/src/components/NodeDetailPanel.tsx`

**Interfaces:**
- Consumes: all components from Task 4 (structure/behavior unchanged, only `className` values and `tailwind.config.ts`/`index.css` change).
- Produces: the same components, visually restyled. No prop or exported-function signature changes — Task 4's tests must still pass unmodified.

- [ ] **Step 1: Invoke the frontend-design skill**

Before writing any CSS, invoke the `frontend-design` skill to establish a real design direction for this specific product (an Indian fintech spend-optimizer — chat-first, trustworthy, data-forward, not a generic SaaS landing page look). Use its guidance to pick: a real color palette (not Tailwind's default `gray-*`/`blue-*`), a type scale, spacing rhythm, and shapes for cards/buttons/inputs. Do this as a genuine design decision, not a placeholder — write down the concrete palette (hex values) and type choices you land on before the next step.

- [ ] **Step 2: Encode the palette in `tailwind.config.ts`**

Update `frontend/tailwind.config.ts`'s `theme.extend` with the concrete values from Step 1 (example shape — replace with the skill's actual output, do not ship these placeholder-style defaults as final):
```typescript
theme: {
  extend: {
    colors: {
      // real values from the frontend-design skill's output go here
    },
    fontFamily: {
      // real values from the frontend-design skill's output go here
    },
  },
},
```

- [ ] **Step 3: Add diagram-specific styling to `index.css`**

`DecisionDiagram.tsx` (Task 4) already assigns `diagram-node-visited`, `diagram-node-dimmed`, `diagram-edge-visited`, `diagram-edge-dimmed` class names. Define their actual appearance in `frontend/src/index.css`, below the `@tailwind` directives, using the palette from Step 1 (example structure, fill in real colors from Step 1's output):
```css
.diagram-node-visited {
  font-weight: 600;
  border-width: 2px;
}
.diagram-node-dimmed {
  opacity: 0.35;
}
.diagram-edge-visited {
  stroke-width: 2px;
}
.diagram-edge-dimmed {
  opacity: 0.25;
}
```

- [ ] **Step 4: Restyle each component**

Update the `className` values (only — no structural/prop changes) in `App.tsx`, `QueryInput.tsx`, `AnswerCard.tsx`, `DecisionDiagram.tsx`, `NodeDetailPanel.tsx` to use the new palette and type scale from Step 1, replacing the plain `border`/`rounded`/`p-4`-style structural classes from Task 4 with the real design system.

- [ ] **Step 5: Confirm Task 4's tests still pass unmodified**

Run: `npm run test`
Expected: all tests still pass — this task changes only visual classes, not component structure, props, or text content the tests assert on. If a test fails because restyling changed visible text or roles, that's a scope violation — revert that specific change and keep the text/structure Task 4 established.

- [ ] **Step 6: Visual check**

Run: `npm run dev` (frontend) and, in another terminal from `backend/`, `uv run uvicorn phase8_api.app:app --reload` (requires a real `GROQ_API_KEY` in `backend/.env`). Open the dev server URL in a browser, submit a real query, expand its diagram, click a node. Confirm the page does not look like default/unstyled Tailwind — real color, real type, deliberate spacing — and that the diagram is legible (visited path clearly distinct from the dimmed rest of the graph).

- [ ] **Step 7: Commit**

```bash
git add frontend/tailwind.config.ts frontend/src/
git commit -m "phase9: apply real visual design system"
```

---

### Task 6: End-to-end manual verification and journal entry

**Files:**
- Modify: `JOURNAL.md`

- [ ] **Step 1: Full manual walkthrough**

With both servers running (`uv run uvicorn phase8_api.app:app --reload` from `backend/`, `npm run dev` from `frontend/`), walk through, in one browser session:
1. A plain query (e.g. "What card should I use for a ₹300 coffee?") — confirm it completes normally, no approval prompt.
2. Expand its diagram — confirm the path highlights `retrieve_memory → reason → respond → critic` (or similar, depending on whether a tool call happened), the rest of the graph is visibly dimmed, and clicking a highlighted node shows real reasoning text (e.g. the critic's actual verdict).
3. A large-purchase query (e.g. "Book a ₹9000 flight, which card?") — confirm the pending-approval state renders with Approve/Decline, and clicking Approve resolves it in place with a real recommendation.
4. A subscription query (e.g. "Am I wasting money on subscriptions?") — confirm it routes correctly and its diagram highlights the `model`/`tools` nodes.
5. A second query in the same session — confirm `thread_id` continuity (the conversation thread grows, doesn't reset).

- [ ] **Step 2: Write the journal entry**

Append to `JOURNAL.md`, following the established Phase 5–8 format (What I built / Key decisions / Gotchas and bugs hit / What I learned / Next up), covering: the chat-first layout decision and why the permanent-split-view alternative was rejected, the decision to custom-render the diagram rather than embed LangGraph's Mermaid output, the pure `computeHighlightedPath` function and why it's separated from `DecisionDiagram`'s rendering, the CORS addition to already-merged Phase 8 code, and results from Step 1's walkthrough (including anything genuinely surprising or a bug caught only by clicking through the real UI, if one occurred).

- [ ] **Step 3: Commit**

```bash
git add JOURNAL.md
git commit -m "phase9: journal entry"
```

---

## Self-Review Notes

- **Spec coverage:** top-level `frontend/` (Task 2), CORS (Task 1), chat-first layout with per-answer diagram expansion (Task 4's `App.tsx`), approval flow (Task 4's `AnswerCard`), custom-rendered diagram not Mermaid (Task 4's `DecisionDiagram` + Task 3's pure logic), per-node reasoning on click (Task 4's `NodeDetailPanel`), typed API client (Task 2), non-default design system (Task 5) — all covered.
- **Type consistency:** `QueryResponse`/`GraphStructure`/`TraceEntry` defined once in Task 2's `types.ts`, consumed identically by `api.ts` (Task 2), `decisionPath.ts` (Task 3), and every component (Task 4) — no redefinition anywhere.
- **No placeholders:** Task 5's Step 1 explicitly requires writing down real, concrete values before Step 2 uses them — the example blocks in Steps 2–3 are marked as illustrative structure, not literal content to ship, per the task's own instructions to the implementer.
- **Diagram data-matching assumption, worth flagging explicitly:** `computeHighlightedPath` matches trace entries to structure nodes by `id` alone (not `id` + `graph`), since `node` names are unique across the three sub-graphs in practice (`reason`, `respond`, `critic`, `retrieve_memory`, `call_tool` only exist in `card_optimizer`; `model`, `tools` only in `subscription_hunter`; `dispatch_node`, `approval_gate` only in `outer`) — confirmed against Phase 8's actual `_build_graph_structure()` output, not assumed.
