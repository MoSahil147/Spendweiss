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
