# SpendWeiss: Phase 9, frontend, design

Date: 2026-07-17
Status: approved, awaiting spec review

## Purpose

Build the website consuming Phase 8's API: a chat-first interface where each answer is shown alongside an on-demand, custom-rendered diagram of the actual decision path the multi-agent graph took to reach it, including the real reasoning behind each step.

## Goals

- New top-level `frontend/` directory (sibling to `backend/`): React + Vite + TypeScript, Tailwind for styling with a deliberately custom design system built during implementation via the `frontend-design` skill — not default Tailwind grays/shapes/component look. Explicit priority carried over from discussion: the site must not read as generically AI-generated ("vibecoded").
- `backend/phase8_api/app.py` gains `CORSMiddleware`, allowing the frontend's origin(s). Small additive change to already-merged Phase 8 code, not a new phase of backend work.
- **Layout:** chat-first. A conversation thread is the primary view. Each answer renders as its own card: the query, the recommendation, and a "See how this was decided" affordance that expands a decision diagram for that specific answer in place, directly under it. Not a separate page, not a permanently-open side panel (that option was considered and explicitly rejected in favor of this one).
- **Approval flow:** when a query's response is `status: "pending_approval"`, that answer card shows the `pending_action` text and Approve/Decline controls in place of the recommendation. Choosing either calls `POST /approve/{thread_id}` and the card updates in place with the final result once resolved.
- **The diagram:** a custom-rendered graph component (React Flow, dagre auto-layout) built from `GET /graph/structure`'s real node/edge JSON — fetched once per session and cached, not re-fetched per query. For a given answer, its `trace` array (an ordered list of `{node, graph, summary}`) determines which nodes/edges are rendered as "on the path" for that query (visually distinct — e.g. solid/colored vs. dimmed for the rest of the graph, which stays present for context) and their order. LangGraph's own `draw_mermaid()` output is explicitly not used for rendering (considered and rejected: generic diagram look, no way to represent a per-query highlighted path or animate it, doesn't fit the "not vibecoded" requirement) — it remains only the underlying source `/graph/structure`'s data was originally derived from, back in Phase 8.
- **Reasoning surfaced per-node:** clicking a node on the highlighted path opens a detail panel showing that step's actual `trace` entry `summary` text — the critic's real critique, a tool's actual result, the routing classification, the recommendation text itself. This is the actual "why," not a generic label; it exists because Phase 8's trace already captures it, this phase's job is just showing it. Nodes not on the path (dimmed, not part of this query's execution) are not clickable.
- `frontend/src/api.ts`: a thin, typed client for the three backend calls (`fetchGraphStructure`, `postQuery`, `postApprove`), with types matching Phase 8's actual response shapes (`status`, `classification`, `trace`, `reply` | `pending_action`, `thread_id`).
- Component breakdown (refined further in the implementation plan): `QueryInput`, `AnswerCard` (recommendation display, or pending-approval state with controls), `DecisionDiagram` (React Flow wrapper consuming structure + trace), `NodeDetailPanel`, plus a top-level `App`/conversation-thread container holding the running list of answer cards and the current `thread_id`.
- Session continuity: `thread_id` is held in browser memory (React state) for the lifetime of the tab, matching Phase 8's own in-memory, non-durable session store — no `localStorage`/persistence promise beyond that, since the backend itself doesn't persist across restarts either.

## Non goals

- No authentication, no multi-user concerns — single-user local/demo use, matching every constraint Phase 8 already established.
- No persistence beyond the browser session/tab lifetime. Refreshing the page starts a new conversation, same as restarting Phase 7's CLI starts a new thread.
- No mobile-specific responsive layout pass. Desktop-first, matching the primary use case (a demo/learning project, not a shipped consumer product).
- No deployment or hosting setup (e.g. containerizing, a production build pipeline beyond Vite's default). Running locally via `npm run dev` against a locally-running `uvicorn` backend is the target for this phase.
- No embedding or use of LangGraph's `draw_mermaid()`/Mermaid rendering anywhere in the UI — decided explicitly during brainstorming (see Goals).
- No changes to Phase 8's route contracts, session store, or trace-capture logic (`dispatch()`, `ApprovalState`) — only the additive `CORSMiddleware` change to `app.py`.

## Repository layout addition

```
frontend/
  index.html
  package.json
  vite.config.ts
  tailwind.config.ts
  .env.example
  src/
    main.tsx
    App.tsx
    api.ts
    components/
      QueryInput.tsx
      AnswerCard.tsx
      DecisionDiagram.tsx
      NodeDetailPanel.tsx
backend/
  phase8_api/
    app.py            # MODIFY: add CORSMiddleware
```

## Data flow

```
App mounts
  -> GET /graph/structure (once, cached in state)

User submits a query
  -> POST /query {message, thread_id?}
  -> status: "completed"     -> AnswerCard renders reply + "see how this was decided"
  -> status: "pending_approval" -> AnswerCard renders pending_action + Approve/Decline

User clicks Approve/Decline on a pending AnswerCard
  -> POST /approve/{thread_id} {approved}
  -> same AnswerCard updates in place with the final result

User clicks "See how this was decided" on any completed AnswerCard
  -> DecisionDiagram renders (graph structure + this answer's trace)
  -> path nodes/edges highlighted in trace order, rest of graph dimmed

User clicks a highlighted node
  -> NodeDetailPanel shows that trace entry's `summary` text
```

## Testing strategy

Component-level tests (Vitest + React Testing Library) for the pure/presentational pieces: `AnswerCard`'s three states (completed, pending, declined), `DecisionDiagram`'s path-highlighting logic given a fixed structure + trace fixture (no real network or LangGraph involved — this is client-side data transformation, testable in isolation the same way Phase 8's `_summarize_update` was tested with fixture data rather than live calls). `api.ts`'s functions get tests against a mocked `fetch`. Full end-to-end verification (real `uvicorn` backend + real `npm run dev` frontend, actually clicking through a query, an approval, and expanding a diagram) is manual, matching every backend phase's live-call verification split — this is a UI, browser-driven verification is the equivalent of those phases' "run it and read the output" step.
