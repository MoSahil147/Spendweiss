# Phase 3: Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Phase 2's agent with short term memory (whole session conversation history) and long term memory (a `search_past_transactions` tool backed by a local Chroma vector store built from `transactions.json`).

**Architecture:** `backend/phase3_memory/memory.py` owns the Chroma collection (build, populate, query). `backend/phase3_memory/tools.py` re-exports Phase 2's tools and adds `search_past_transactions`. `backend/phase3_memory/agent.py` mirrors Phase 2's agent but keeps one `messages` list across the whole interactive session instead of resetting it per query.

**Tech Stack:** `chromadb` (new), `langchain`, `langchain-groq`, `python-dotenv`, `pytest`. Model id `llama-3.3-70b-versatile`, unchanged from Phase 1 and 2.

## Global Constraints

- All prose is British English, no em dashes.
- Code carries explanatory comments in British English (standing project convention).
- Do not run `git add`, `git commit`, `git push`, open a pull request, or run any `gh api` command, ever, in any form including dry runs, without explicit confirmation from the user first. The user stages, commits, pushes, and opens pull requests themselves.
- Phase 1 and Phase 2's files are not modified.
- Phase 3 must be run as a module, for the same cross package import reason as Phase 2: `uv run python -m phase3_memory.agent` from inside `backend/`.
- `backend/phase3_memory/chroma_data/` is gitignored, it is a rebuildable index, not source data.

---

### Task 1: Dependency, package structure, and gitignore entry

**Files:**
- Modify: `backend/pyproject.toml` (via `uv add chromadb`)
- Modify: `.gitignore` (add `backend/phase3_memory/chroma_data/`)
- Create: `backend/phase3_memory/__init__.py` (empty)

**Interfaces:**
- Produces: `backend/phase3_memory` as a proper Python package, `chromadb` available in the `uv` venv.

- [ ] **Step 1: Add chromadb**

```bash
cd backend && uv add chromadb
```
Expected: resolves and installs. If this conflicts with an existing pin (the same shape of problem Phase 2 hit with `langchain-groq` and `groq`), relax the conflicting pin in `backend/pyproject.toml` rather than avoiding `chromadb`, then re-run this command.

- [ ] **Step 2: Re-verify Phase 1 and Phase 2 still work after the dependency change**

```bash
uv run pytest -v
```
Expected: all 10 existing tests still pass. If `chromadb`'s dependency resolution downgraded or upgraded something Phase 1 or Phase 2 relies on, this is where it would show up.

- [ ] **Step 3: Create the package marker**

```bash
touch backend/phase3_memory/__init__.py
```

- [ ] **Step 4: Add the chroma_data gitignore entry**

Add to `.gitignore`:
```
backend/phase3_memory/chroma_data/
```

---

### Task 2: Write memory.py and determine the relevance threshold

**Files:**
- Create: `backend/phase3_memory/memory.py`

**Interfaces:**
- Consumes: `backend/data/transactions.json`.
- Produces: `get_collection()` and `ensure_populated(collection)`, consumed by Task 3's `tools.py`. Also produces the empirically determined distance threshold used in Task 3.

- [ ] **Step 1: Write `backend/phase3_memory/memory.py`**

```python
# Long term memory: a local Chroma vector store built from transactions.json,
# so the agent can retrieve relevant past spending rather than only reasoning
# about the current purchase. Chroma's default embedding function runs a
# small model locally, no API key or paid service involved.
import json
from pathlib import Path

import chromadb

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CHROMA_DIR = Path(__file__).resolve().parent / "chroma_data"


def get_collection():
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(name="transactions")


def _transaction_to_text(transaction):
    return (
        f"{transaction['date']}: {transaction['merchant']}, {transaction['category']}, "
        f"Rs {transaction['amount']}, paid with card {transaction['card_used']}"
    )


def ensure_populated(collection):
    if collection.count() > 0:
        return

    with open(DATA_DIR / "transactions.json") as data_file:
        transactions = json.load(data_file)

    collection.add(
        ids=[str(index) for index in range(len(transactions))],
        documents=[_transaction_to_text(transaction) for transaction in transactions],
        metadatas=transactions,
    )
```

- [ ] **Step 2: Populate the collection and inspect real distances to pick a threshold**

```bash
cd backend && uv run python -c "
from phase3_memory.memory import get_collection, ensure_populated
collection = get_collection()
ensure_populated(collection)
print('count:', collection.count())
matching = collection.query(query_texts=['BigBasket'], n_results=5, include=['metadatas', 'distances'])
print('BigBasket query distances:', matching['distances'][0])
nonsense = collection.query(query_texts=['quantum physics homework'], n_results=5, include=['metadatas', 'distances'])
print('nonsense query distances:', nonsense['distances'][0])
"
```
Expected: `count: 24`. The first run downloads Chroma's default embedding model, a one time cost. Read the two printed distance lists: the `BigBasket` query's closest distances should be noticeably smaller (more similar) than the nonsense query's closest distances. Pick a threshold value strictly between the smallest distance in the `BigBasket` list and the smallest distance in the nonsense list, this becomes `RELEVANCE_THRESHOLD` in Task 3. Do not guess this number without running the command, the actual embedding model's distance scale is what determines a sensible cutoff.

---

### Task 3: Write tools.py with the relevance threshold from Task 2

**Files:**
- Create: `backend/phase3_memory/tools.py`
- Create: `backend/tests/test_phase3_memory.py`

**Interfaces:**
- Consumes: `check_card_rewards`, `check_offers` from `backend/phase2_langchain/tools.py`. `get_collection`, `ensure_populated` from `backend/phase3_memory/memory.py` (Task 2). The `RELEVANCE_THRESHOLD` value determined in Task 2, Step 2.
- Produces: `check_card_rewards`, `check_offers`, `search_past_transactions`, consumed by Task 4's `agent.py`.

- [ ] **Step 1: Write `backend/phase3_memory/tools.py`**

Replace `<THRESHOLD>` below with the actual value chosen in Task 2, Step 2.

```python
# Phase 3 reuses Phase 2's tools unchanged, and adds one new tool for long
# term memory: retrieving relevant past transactions from the Chroma
# collection built in memory.py. Chroma always returns its nearest
# neighbours regardless of relevance, so RELEVANCE_THRESHOLD filters out
# matches that are not actually close, this value was chosen empirically in
# Task 2 by comparing real distances for a matching and a nonsense query,
# not guessed.
import json

from langchain.tools import tool

from phase2_langchain.tools import check_card_rewards, check_offers
from phase3_memory.memory import ensure_populated, get_collection

RELEVANCE_THRESHOLD = <THRESHOLD>


@tool
def search_past_transactions(query: str) -> str:
    """Search past transactions for spending patterns relevant to a query.

    Args:
        query: what to search for, for example a merchant name or a category.

    Returns a JSON list of matching past transactions, or an empty JSON list if there are none.
    """
    collection = get_collection()
    ensure_populated(collection)
    results = collection.query(query_texts=[query], n_results=5, include=["metadatas", "distances"])
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]
    matches = [
        metadata
        for metadata, distance in zip(metadatas, distances)
        if distance <= RELEVANCE_THRESHOLD
    ]
    return json.dumps(matches)
```

- [ ] **Step 2: Write the tests**

Create `backend/tests/test_phase3_memory.py`:

```python
import json

from phase3_memory.tools import search_past_transactions


def test_search_past_transactions_finds_bigbasket():
    result = search_past_transactions.invoke({"query": "BigBasket"})
    matches = json.loads(result)
    assert len(matches) > 0
    assert any(match["merchant"] == "BigBasket" for match in matches)


def test_search_past_transactions_irrelevant_query_returns_non_empty_json_string():
    result = search_past_transactions.invoke({"query": "quantum physics homework"})
    assert result == "[]"
    assert json.loads(result) == []
```

- [ ] **Step 3: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest tests/test_phase3_memory.py -v
```
Expected: 2 tests, both `PASSED`. If `test_search_past_transactions_irrelevant_query_returns_non_empty_json_string` fails because the nonsense query still returned matches, `RELEVANCE_THRESHOLD` is set too high, lower it based on the distances observed in Task 2, Step 2, and re-run.

---

### Task 4: Write the agent with session wide short term memory

**Files:**
- Create: `backend/phase3_memory/agent.py`

**Interfaces:**
- Consumes: `check_card_rewards`, `check_offers`, `search_past_transactions` from `backend/phase3_memory/tools.py` (Task 3).
- Produces: a runnable module, `uv run python -m phase3_memory.agent` from inside `backend/`.

- [ ] **Step 1: Write `backend/phase3_memory/agent.py`**

```python
# Phase 3: same LangChain agent as Phase 2, now with two kinds of memory.
# Short term: the messages list below is created once, outside the query
# loop, and grows with every query and response, so a follow up question in
# the same session can refer back to an earlier one, this is the whole
# point of this phase and the main difference from Phase 2's agent.py,
# which built a fresh two message list on every single query. Long term:
# the new search_past_transactions tool retrieves from a local Chroma
# collection built from transactions.json, so the agent can ground answers
# in actual spending history, not just the current purchase.
import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.messages import AIMessage, ToolMessage
from langchain_groq import ChatGroq

from phase3_memory.tools import check_card_rewards, check_offers, search_past_transactions

load_dotenv()

MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are SpendWeiss, an assistant that recommends the best card for a purchase.

Use the check_card_rewards and check_offers tools to reason about which card
gives the best value for the purchase described, considering both ongoing
reward rates and any active limited time offers. Use search_past_transactions
when the user's question would benefit from knowing their spending history,
for example a recurring merchant or typical spend in a category, not on
every query. Give a clear final recommendation with your reasoning.
"""


def print_new_messages(messages, already_seen_count):
    for message in messages[already_seen_count:]:
        if isinstance(message, AIMessage) and message.tool_calls:
            for tool_call in message.tool_calls:
                print(f"\nModel requested tool: {tool_call['name']} args={tool_call['args']}")
        elif isinstance(message, ToolMessage):
            print(f"Tool result [{message.name}]: {message.content}")
        elif isinstance(message, AIMessage):
            print(f"\nRecommendation: {message.content}")


def main():
    model = ChatGroq(model=MODEL, api_key=os.environ["GROQ_API_KEY"])
    agent = create_agent(
        model,
        tools=[check_card_rewards, check_offers, search_past_transactions],
        system_prompt=SYSTEM_PROMPT,
    )

    # Created once, outside the loop: this is the whole session's short
    # term memory. Every query appends to it, and the full history is sent
    # to the model again on the next query.
    messages = []

    print("SpendWeiss Phase 3. Describe a purchase, or press Ctrl+C to quit.")
    while True:
        try:
            purchase_description = input("\nWhat's the purchase? ")
        except KeyboardInterrupt:
            print("\nGoodbye.")
            break

        if not purchase_description.strip():
            continue

        messages.append({"role": "user", "content": purchase_description})
        already_seen_count = len(messages)
        result = agent.invoke({"messages": messages})
        messages = result["messages"]
        print_new_messages(messages, already_seen_count)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Confirm the module starts**

```bash
cd backend && echo "" | uv run python -m phase3_memory.agent
```
Expected: prints the startup banner and prompt, then an `EOFError` traceback once piped stdin runs out, the same expected non-interactive smoke test behaviour as Phase 1 and Phase 2.

---

### Task 5: End to end verification and journal entry

**Files:**
- Modify: `JOURNAL.md`

**Interfaces:**
- Consumes: the running `agent.py` from Task 4.

- [ ] **Step 1: Run a sequence that exercises both kinds of memory**

```bash
cd backend && printf 'How many times have I shopped at BigBasket recently?\nGiven that, should I use a different card for groceries going forward?\n' | uv run python -m phase3_memory.agent
```
Expected: the first query triggers a `search_past_transactions` tool call and answers referencing the three real BigBasket transactions in the mock data. The second query, which only makes sense with short term memory (it says "given that" referring back to the first answer, and does not repeat what "that" means), should be answered in a way that shows the model still has the first query and its answer in context, not treating the second query as a standalone, context free question. Read the actual output rather than assuming this worked, since this is exactly the kind of thing that looks fine in the code but needs to be seen actually happening.

- [ ] **Step 2: Add the journal entry**

Append to `JOURNAL.md`:

```
## Phase 3: Memory (2026-07-16)

**What I built:**

**Key decisions:**

**Gotchas and bugs hit:**

**What I learned:**

**Next up:**
```

- [ ] **Step 3: Final check**

```bash
git status --short
```
Expected: `backend/phase3_memory/`, `backend/tests/test_phase3_memory.py`, the modified `backend/pyproject.toml`, `backend/uv.lock`, `.gitignore`, and `JOURNAL.md` all appear as untracked or modified, nothing staged. Do not stage or commit anything, the user does that themselves.
