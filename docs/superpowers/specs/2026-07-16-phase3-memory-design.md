# SpendWeiss: Phase 3, memory, design

Date: 2026-07-16
Status: approved, awaiting spec review

## Purpose

Extend Phase 2's agent so its recommendations can reference the user's actual spending history, not only the purchase described in the current query. Two kinds of memory are added: short term, the running conversation within one terminal session, and long term, retrieval over the mock `transactions.json` data via a local vector store.

## Goals

- Short term memory: the interactive loop keeps one running `messages` list for the whole session, rather than starting a fresh conversation on every query as Phase 1 and Phase 2 did. A follow up question can refer back to an earlier one in the same session.
- Long term memory: a new tool, `search_past_transactions`, backed by a local Chroma collection built from `transactions.json`, so the agent can answer questions like how often a merchant was used, or how much was typically spent in a category, grounded in the mock transaction history rather than invented.
- Reuse Phase 2's tools rather than duplicating them, the same reuse pattern Phase 2 used for Phase 1.
- Stay on the free tier throughout. Chroma's default embedding function runs a small local model, no external API key or paid service involved.

## Non goals

- No capping or summarising of the conversation history. The whole session's messages are kept, unbounded. This is a deliberate simplification, acceptable for a short lived terminal session with a handful of exchanges, not a design intended to scale to long running conversations.
- No LangGraph, `StateGraph`, or explicit nodes and edges. That is Phase 4.
- No critic or reflection step. That is Phase 5.
- No changes to Phase 1 or Phase 2's files, beyond the existing pattern of importing from them.
- No changes to the mock data. `transactions.json` is read, not modified.

## Repository layout addition

```
backend/
  phase3_memory/
    __init__.py
    memory.py
    tools.py
    agent.py
    chroma_data/        (gitignored, rebuilt from transactions.json on first run)
```

## Dependencies

`chromadb`, added via `uv add chromadb` from inside `backend/`. If this creates a dependency conflict with the existing LangChain or Groq packages, the same way `langchain-groq` conflicted with the direct `groq` pin in Phase 2, it is resolved the same way: relax an overly strict version pin rather than avoiding the package, and re-verify the earlier phases still work afterwards.

## `backend/phase3_memory/memory.py`

- `get_collection()`: creates a `chromadb.PersistentClient(path=...)` rooted at `backend/phase3_memory/chroma_data/`, and calls `get_or_create_collection(name="transactions")` using Chroma's default embedding function, no explicit embedding model configuration, so no API key is needed.
- `ensure_populated(collection)`: if the collection is empty (`collection.count() == 0`), reads `backend/data/transactions.json` and adds one document per transaction, each document a short natural language sentence built from that transaction's fields, for example `"2026-06-02: BigBasket, groceries, Rs 2200, paid with HDFC Millennia Credit Card"`, with the transaction's id (its position in the list, as a string) as the Chroma document id, and the raw transaction fields stored as metadata. Idempotent, safe to call on every run.

## `backend/phase3_memory/tools.py`

Imports `check_card_rewards` and `check_offers` from `phase2_langchain.tools` (not reimplemented). Adds a third `@tool` decorated function:

- `search_past_transactions(query: str) -> str`: calls `ensure_populated` then queries the Chroma collection for the top 5 nearest matches against `query`, including distances. Chroma's similarity search always returns its nearest neighbours regardless of relevance, there is no built in "no match" the way `check_offers`' substring search has, so results are filtered by a distance threshold, only matches closer than the threshold are kept. The threshold value is determined empirically during implementation (Task 2 of the plan), not guessed, by running one query expected to match and one expected not to, and picking a cutoff between the two observed distances. Returns a JSON string of the filtered matches (matching Phase 2's fix for Groq rejecting empty array tool message content: an empty result becomes `"[]"`, not `[]`).

## `backend/phase3_memory/agent.py`

- Same `ChatGroq` and `create_agent` setup as Phase 2's `agent.py`, tools list now `[check_card_rewards, check_offers, search_past_transactions]`.
- System prompt gains one additional instruction: use `search_past_transactions` when the query would benefit from knowing the user's spending history (recurring merchants, typical spend in a category), not on every query.
- The interactive loop's `messages` list is created once, outside the per query loop, and each query's user message and the agent's full response messages are appended to it and carried into the next query, implementing the whole session short term memory.

## Error handling

Same pattern as Phase 2: LangChain and the model handle malformed tool arguments; no hand written retry logic is reintroduced here.

## Testing

`backend/tests/test_phase3_memory.py`: tests `search_past_transactions` directly, asserting a query for a merchant that appears multiple times in `transactions.json` (for example BigBasket, which appears three times, verified against the actual data rather than assumed) returns results, and a query for a merchant that does not exist returns the JSON string `"[]"`. Building the Chroma collection the first time downloads a small model file; this test tolerates that one time cost rather than mocking it away, since the point is to prove the real retrieval path works.

## Verification

Manual: run `backend/phase3_memory/agent.py` interactively (as a module, `uv run python -m phase3_memory.agent`, for the same cross package import reason established in Phase 2) with a short sequence of queries, at least one of which should trigger `search_past_transactions` (for example asking how often BigBasket was used), and at least one follow up query that only makes sense with short term memory (for example referring back to "that purchase" from the previous query), confirming the agent's answer actually uses the earlier context rather than treating the follow up as a standalone question.

## Open questions

None outstanding. All prior questions in this design conversation have been resolved.
