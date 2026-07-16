# SpendWeiss Journal

A running log of what got built, decided and learned at each phase of the SpendWeiss project. One entry per phase, added once that phase is verified and merged to main.

---

## Template

```
## Phase N: <name> (YYYY-MM-DD)

**What I built:**

**Key decisions:**

**Gotchas and bugs hit:**

**What I learned:**

**Next up:**
```

---

## Phase 0: Setup (2026-07-16)

**What I built:**
Scaffolded the backend project with `uv init backend`, removed the generated stub script, and added `groq` and `python-dotenv` as dependencies via `uv add`. Created `backend/.env.example` and `backend/.env` (the latter holding a placeholder key until a real Groq key is added). Created the three mock data files, all reflecting the Indian market: `backend/data/cards.json` (six real Indian credit cards: HDFC Millennia, Axis Bank Magnus, ICICI Amazon Pay, HDFC Infinia, SBI Cashback, IDFC FIRST Select, with reward rates researched via web search and simplified from each card's actual published structure, not invented), `backend/data/offers.json` (six offers, one per card, each grounded in a real promotion type researched for that card: BigBasket, IndiGo via the EDGE travel portal, Amazon.in, MakeMyTrip via SmartBuy, Myntra, and the District app BOGO movie offer), and `backend/data/transactions.json` (twenty four past transactions spanning all six cards and all six categories, across twelve Indian merchants including BigBasket, DMart, Swiggy, Zomato, IndiGo, MakeMyTrip, Ola Cabs, Amazon.in, Myntra, Croma, Netflix, District and two petrol pumps, amounts in rupees). All three JSON files verified to parse correctly and to match what the plan document specifies byte for byte.

**Key decisions:**
Working on branch `phase-0-1-setup`, checked out from `main`, not `phase-0-setup` and `phase-1-raw-react` as two separate branches. Phase 0 and Phase 1 were designed as a single spec and plan, so they are being built on a single branch and will be merged to `main` in one go, by the user, once both are verified. `.env` and `.env.example` live inside `backend/`, not the repository root, so that `python-dotenv`'s default lookup from the current working directory finds them automatically when running `uv run` from inside `backend/`, and so that backend secrets stay separate from the frontend's own env file once Phase 8 adds one. All mock data was switched from a generic placeholder market to real Indian banks and merchants at the user's request, expanded from three cards to six, and then corrected a second time so the reward rates reflect each card's real, published terms rather than plausible sounding invented numbers. This surfaced a realistic and useful detail: most of these cards genuinely exclude fuel from reward earning (offering only a surcharge waiver instead), and IDFC FIRST Select genuinely earns far less than the cashback focused cards, since its real advantage is being lifetime free rather than high reward rate. `check_card_rewards` does not model this fee trade-off, only raw reward rate, which is a reasonable Phase 1 simplification worth revisiting later.

**Gotchas and bugs hit:**
`uv init` generates a placeholder `main.py` by default, which is not needed here and was deleted.

**What I learned:**
`uv init <name>` both creates the project directory and initialises it in one step, no need for a separate `mkdir` first.

**Next up:**
Phase 1: build `backend/phase1_raw_react/tools.py` (the `check_card_rewards` and `check_offers` functions) and `backend/phase1_raw_react/agent.py` (the hand rolled ReAct loop).

**Phase 0 status: complete**, verified with a final check: dependencies importable from the `uv` venv, all three data files parse and cross reference correctly (every card has exactly one offer), `.env` and `.env.example` both present, and `.env` confirmed git ignored.

---

## Phase 1: The raw ReAct loop (2026-07-16)

**What I built:**
`backend/phase1_raw_react/tools.py`, with `check_card_rewards(category)` and `check_offers(merchant)` reading the JSON data directly. `backend/phase1_raw_react/agent.py`, a hand rolled ReAct loop against the Groq API (`llama-3.3-70b-versatile`), using a JSON action protocol defined by hand in the system prompt rather than Groq's native `tools=` parameter. Capped at six iterations, with one corrective retry on malformed JSON or an unknown action before aborting that query.

**Key decisions:**
Verified `tools.py` directly first (`check_card_rewards('online_shopping')`, `check_offers('bigbasket')`), matching the plan's expected output exactly, including the three way tie at the top of online shopping. Then verified `agent.py` end to end by piping three sample purchase descriptions into it non-interactively, rather than a live terminal session, since this runs inside an agentic coding session without a real TTY.

**Gotchas and bugs hit:**
Piped stdin runs out eventually and `input()` raises `EOFError` once it does. This is expected for the piped test harness, not a bug in the script, a real interactive terminal session exits cleanly on Ctrl+C instead, which is what the `except KeyboardInterrupt` branch is for.

**What I learned:**
Watching the actual trace made the model's reasoning legible in a way that's easy to take for granted once frameworks hide it: for the BigBasket query, the model correctly weighed a 10 percent limited time offer against a higher underlying reward rate on a different card, and picked the offer because it produced more rupees of value on that specific transaction. That kind of comparison is exactly what Phase 1 was meant to make visible.

**Next up:**
The CI pipeline (pytest suite, GitHub Actions workflow, branch protection, auto-merge) is in progress in parallel on this same branch. Once that is finished and the journal entry for it is added, this branch is ready for a pull request. After that, Phase 2 rebuilds this same agent using `langchain-groq`.

**Convention change, 2026-07-16:** the original "no comments in code" rule from the Phase 0 and 1 spec is reversed, from now on code carries explanatory British English comments. This is a learning project, comments explaining the why and the mechanics are part of the point, not clutter. `tools.py` and `agent.py` were retrofitted with comments accordingly. The `test_data.py` and `ci.yml` files from the CI pipeline work predate this change and were left uncommented, they are short and self-explanatory.

---

## Phase 2: The agent with LangChain (2026-07-16)

**What I built:**
`backend/phase2_langchain/tools.py`, wrapping Phase 1's `check_card_rewards` and `check_offers` with LangChain's `@tool` decorator rather than reimplementing them, each wrapper returning a JSON string. `backend/phase2_langchain/agent.py`, using `ChatGroq` and `create_agent` from `langchain.agents`. `backend/tests/test_phase2_tools.py`, three tests asserting the wrapped tools agree with Phase 1's raw functions. Ran the same three sample purchase queries used to verify Phase 1 (BigBasket groceries, IndiGo flight, Croma gadget) end to end against a live Groq model, all three produced sensible tool calls and recommendations.

**Key decisions:**
Followed the current LangChain documentation (checked via Context7 on 2026-07-16) rather than the original project brief, which named `create_tool_calling_agent` and `AgentExecutor`. Those are now the older pattern; `create_agent` is the current recommended entry point and runs on LangGraph internally, a preview of Phase 4. `create_agent`'s `.invoke()` hides intermediate steps by default, so `agent.py` walks the returned message list by hand (`print_new_messages`) to keep the trace as visible as Phase 1's was, since staying able to see the reasoning is the point of this whole project. Phase 1's `agent.py` and `tools.py` were left completely unmodified except for adding an empty `__init__.py`, so Phase 2 could import from it as a proper package; this also required switching Phase 2's run command to `uv run python -m phase2_langchain.agent` (a module) rather than a plain script, since a script invocation only puts its own directory on `sys.path`, not `backend/`.

**Gotchas and bugs hit:**
Adding `langchain-groq` created a real dependency conflict: every version of `langchain-groq`, including the latest, depends on `groq<1`, but Phase 1 had pinned `groq>=1.5.0` directly. Relaxed the direct `groq` pin in `pyproject.toml` to let `uv` resolve a compatible version (`groq` ended up downgraded to `0.37.1`), then re-ran Phase 1's `agent.py` manually to confirm it still worked with the older client, which it did, the `chat.completions.create` call shape Phase 1 depends on is stable across that version range.

A second, more interesting bug: the third sample query (Croma, no matching offer) crashed with `groq.BadRequestError`, Groq rejected a `role: tool` message whose content was an empty array. `check_offers` legitimately returns `[]` when nothing matches, and LangChain was passing that empty Python list straight through as the tool message's content. Fixed by having both `@tool` wrappers return `json.dumps(...)` strings instead of raw Python objects, so an empty result becomes the string `"[]"`, non-empty and therefore valid, rather than an empty array. Updated `test_phase2_tools.py` to match, including a dedicated test for this exact case (`test_check_offers_no_match_returns_non_empty_json_string`) so it cannot silently regress.

**What I learned:**
The framework genuinely does remove real code: `agent.py` has no while loop, no manual JSON parsing, and no hand written retry logic, `create_agent` and Groq's native tool calling handle all of that. But it does not remove all the sharp edges, the empty-list content bug is exactly the kind of integration detail that a framework's abstraction can paper over until it doesn't. Comparing the two recommendations for the BigBasket query was also informative: Phase 1's model picked the HDFC Millennia offer, Phase 2's model (a different run, same underlying model) reasoned through both options explicitly and also picked Millennia, in both cases correctly, but the shorter Phase 2 system prompt (no JSON protocol to explain) still produced comparably careful reasoning.

**Next up:**
Phase 3 adds memory: a conversation buffer for short term context and Chroma backed retrieval over `transactions.json` for long term context, so recommendations start referencing spending patterns, not just the current purchase. The CI pipeline's branch protection and auto-merge steps are still paused from earlier and should be finished before too many more phases pile up unprotected commits on `main`.
