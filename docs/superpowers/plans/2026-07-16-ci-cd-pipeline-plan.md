# CI Pipeline with PR Gated Auto-Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give SpendWeiss a real CI gate on `main`: a pytest suite covering the Phase 0 mock data, a GitHub Actions workflow that runs it on every pull request, branch protection that requires that check to pass, and the repository setting that allows GitHub's native auto-merge toggle to be armed.

**Architecture:** `pytest` added as a `uv` dev dependency, tests live under `backend/tests/`. `.github/workflows/ci.yml` runs `uv sync` and `uv run pytest` on every pull request targeting `main`. Branch protection and the auto-merge repository setting are applied with `gh api`, each shown to the user before it runs.

**Tech Stack:** `pytest`, GitHub Actions, `astral-sh/setup-uv` action, `gh` CLI (already authenticated as `MoSahil147`, repo is `MoSahil147/Spendweiss`, default branch `main`).

## Global Constraints

- All prose is British English, no em dashes.
- Code carries explanatory comments in British English (this reverses an earlier "no comments" rule; see `JOURNAL.md`, 2026-07-16). The `test_data.py` and `ci.yml` content already written into this plan predates that change and stays uncommented; it is short and self-explanatory enough not to need retrofitting, but new code from here on should be commented.
- Do not run `git push`, open a pull request, or run any `gh api` command that changes repository settings without first showing the user the exact command and getting explicit confirmation. This is stricter than the general "no add or push" rule already in place: even with a plan approved, these specific actions pause for a live confirmation each time, per the spec's risk section.
- Local file creation, `git add`, local commits, and running `pytest` locally do not need this pause, they are reversible and local.
- Actually, per the user's standing instruction from earlier in this project, do not run `git add` or `git commit` either, unless the user asks. Leave everything unstaged until told otherwise. This plan only stages nothing; it writes files and runs local verification commands.

---

### Task 1: Add pytest and write the data test suite

**Files:**
- Modify: `backend/pyproject.toml` (via `uv add --dev pytest`)
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_data.py`

**Interfaces:**
- Produces: a `backend/tests/` package that `uv run pytest` discovers automatically from inside `backend/`. No other task depends on this one's internals, but Task 2's workflow depends on `uv run pytest` succeeding here.

- [ ] **Step 1: Add pytest as a dev dependency**

```bash
cd backend && uv add --dev pytest
```
Expected: `pytest` added under `[dependency-groups]` (or `[tool.uv.dev-dependencies]` depending on `uv` version) in `backend/pyproject.toml`, and installed into `.venv`.

- [ ] **Step 2: Create the test package marker**

Create `backend/tests/__init__.py`, empty file.

- [ ] **Step 3: Write the failing tests first**

Create `backend/tests/test_data.py`:

```python
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CATEGORIES = {"groceries", "dining", "travel", "online_shopping", "fuel", "other"}


def load_json(filename):
    with open(DATA_DIR / filename) as data_file:
        return json.load(data_file)


def test_six_cards():
    cards = load_json("cards.json")
    assert len(cards) == 6


def test_six_offers():
    offers = load_json("offers.json")
    assert len(offers) == 6


def test_twenty_four_transactions():
    transactions = load_json("transactions.json")
    assert len(transactions) == 24


def test_every_card_has_exactly_one_offer():
    cards = load_json("cards.json")
    offers = load_json("offers.json")
    card_ids = {card["id"] for card in cards}
    offer_card_ids = [offer["card_id"] for offer in offers]
    assert set(offer_card_ids) == card_ids
    assert len(offer_card_ids) == len(set(offer_card_ids))


def test_card_reward_categories_are_known():
    cards = load_json("cards.json")
    for card in cards:
        assert set(card["reward_rates"].keys()) == CATEGORIES


def test_transaction_categories_are_known():
    transactions = load_json("transactions.json")
    for transaction in transactions:
        assert transaction["category"] in CATEGORIES


def test_transaction_cards_exist():
    cards = load_json("cards.json")
    transactions = load_json("transactions.json")
    card_ids = {card["id"] for card in cards}
    for transaction in transactions:
        assert transaction["card_used"] in card_ids
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest tests/test_data.py -v
```
Expected: 7 tests, all `PASSED`. If any fail, the underlying data file has a real inconsistency, fix the data file, not the test, since the test encodes what Task 2 of the Phase 0 plan already established as true.

---

### Task 2: Write the GitHub Actions workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `backend/pyproject.toml` and `backend/tests/` from Task 1.
- Produces: a workflow that runs the test suite on every pull request against `main`, comments on the pull request with the result, and merges it automatically on success. No other task depends on a specific job id from this one, branch protection in Task 3 no longer requires a named status check, see the spec's Non goals for why.

Before writing the workflow, confirm the latest available versions of the two actions used, rather than copying versions from memory:

```bash
curl -s https://api.github.com/repos/actions/checkout/releases/latest | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'])"
curl -s https://api.github.com/repos/astral-sh/setup-uv/releases/latest | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'])"
```
Use whatever major version tags these report (for example `v7` and `v8`) in place of the versions shown in Step 1 below if they have changed since this plan was written.

- [ ] **Step 1: Resolve commit SHAs for the pinned actions**

```bash
curl -s https://api.github.com/repos/astral-sh/setup-uv/git/refs/tags/v8.3.2 --jq '.object.sha'
curl -s https://api.github.com/repos/actions/checkout/git/refs/tags/v7.0.0 --jq '.object.sha'
```
Use these SHAs (or freshly resolved ones, if the latest tag has moved on since this plan was written) in Step 2, each with the human readable tag kept as a trailing comment.

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

Two jobs, following least privilege: `test` has the default read only token and does the actual work, `merge` is the only job with write access and does not check out any code, it only calls `gh` based on whether `test` succeeded.

```yaml
name: CI

on:
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      - uses: astral-sh/setup-uv@11f9893b081a58869d3b5fccaea48c9e9e46f990 # v8.3.2
      - run: uv sync
        working-directory: backend
      - run: uv run pytest
        working-directory: backend

  merge:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Comment and merge on success
        if: needs.test.result == 'success'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr comment ${{ github.event.pull_request.number }} --repo ${{ github.repository }} --body "All tests passed, merging automatically."
          gh pr merge ${{ github.event.pull_request.number }} --repo ${{ github.repository }} --squash --delete-branch
      - name: Comment on failure
        if: needs.test.result == 'failure'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh pr comment ${{ github.event.pull_request.number }} --repo ${{ github.repository }} --body "Tests failed, auto-merge blocked."
```

None of the `run:` blocks above interpolate any untrusted pull request supplied text (title, body, branch name); the only template values used are `github.event.pull_request.number` (a plain integer) and `github.repository` (a fixed value for this workflow run), so there is no shell or GitHub Actions expression injection risk here. This was checked against an automated security review during development, which separately flagged the earlier single job, unpinned action version of this workflow; both points are fixed in this version, not dismissed.

- [ ] **Step 2: Validate the YAML locally**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid yaml')"
```
Expected output: `valid yaml`. If `PyYAML` is not available in the system Python, install it into a throwaway venv rather than skipping this check: `python3 -m venv /tmp/yamlcheck && /tmp/yamlcheck/bin/pip install pyyaml -q && /tmp/yamlcheck/bin/python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid yaml')"`.

This workflow cannot be fully exercised until it exists on a branch with an open pull request against `main`, which is why Task 4 covers end to end verification after Task 3's branch protection is in place. Opening that pull request is the user's action, not a step in this plan.

---

### Task 3: Configure branch protection on main

**Files:** none, this task only runs `gh api` commands against the repository's settings.

**Interfaces:** none, standalone repository configuration.

- [ ] **Step 1: Show the user the exact command before running it**

State to the user: this will configure branch protection on `main` for `MoSahil147/Spendweiss`, disallowing direct pushes so every change must go through a pull request. Deliberately does not require a named status check, since Task 2's workflow merges from within the same job that runs the tests, a required check would still show as pending at the moment that job tries to merge, and would block it. The workflow's own `if: success()` step is what gates the merge on tests passing, not branch protection. Wait for explicit confirmation before running Step 2.

- [ ] **Step 2: Apply branch protection**

```bash
gh api repos/MoSahil147/Spendweiss/branches/main/protection \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -f "required_status_checks=null" \
  -F "enforce_admins=true" \
  -F "required_pull_request_reviews=null" \
  -F "restrictions=null" \
  -F "allow_force_pushes=false" \
  -F "allow_deletions=false"
```
Expected: a JSON response describing the new protection rule, HTTP 200. If this returns a 404 or a permissions error, the authenticated `gh` account does not have admin rights on the repository, stop and report this to the user rather than trying workarounds.

- [ ] **Step 3: Verify**

```bash
gh api repos/MoSahil147/Spendweiss/branches/main/protection --jq '{required_status_checks, allow_force_pushes: .allow_force_pushes.enabled}'
```
Expected: `required_status_checks` is `null`, `allow_force_pushes` is `false`.

---

### Task 4: Verify the whole pipeline

**Files:** none. This task only runs once the user has opened a real pull request; nothing here is a file change made by the agent.

**Interfaces:**
- Consumes: Task 1's tests, Task 2's workflow, and Task 3's branch protection, exercised together for the first time.

The user opens the pull request themselves (stated explicitly during this project's CI redesign: "pull request will be given by me"), committing and pushing whichever branch has Task 1 and Task 2's new files first. This plan does not commit, push, or open the pull request.

- [ ] **Step 1: Watch the checks once a pull request exists**

Once the user confirms a pull request is open against `main`:
```bash
gh pr checks --watch
```
Expected: the `test` job reports `pass` within a couple of minutes. If it reports `fail`, read the workflow log with `gh run view --log-failed` and report the underlying issue to the user rather than guessing a fix (most likely a `uv sync` or `pytest` failure that did not reproduce locally, for example a Python version mismatch between the workflow's `ubuntu-latest` image and the local machine).

- [ ] **Step 2: Confirm the automatic comment and merge happened**

```bash
gh pr view --json state,mergedAt,comments --jq '{state, mergedAt, lastComment: .comments[-1].body}'
```
Expected: `"state": "MERGED"`, a non-null `mergedAt`, and `lastComment` reading `"All tests passed, merging automatically."`. No manual merge click involved anywhere in this sequence.

- [ ] **Step 3: Update the journal**

Append to `JOURNAL.md`, filling in the template with what happened in this task (in particular, what the first real automatic merge showed, and whether the branch protection change without a required status check behaved as expected):

```
## CI/CD pipeline: pytest, GitHub Actions, fully automatic merge on green (2026-07-16)

**What I built:**

**Key decisions:**

**Gotchas and bugs hit:**

**What I learned:**

**Next up:**
```
