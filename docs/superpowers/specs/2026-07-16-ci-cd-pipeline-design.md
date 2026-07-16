# SpendWeiss: CI pipeline with PR gated auto-merge design

Date: 2026-07-16
Status: approved, awaiting spec review

## Purpose

Give SpendWeiss a real continuous integration gate on `main`, so that merging a phase branch no longer depends on the user manually reviewing and clicking merge. Every change to `main` goes through a pull request, opened by the user, and GitHub Actions takes it from there entirely: runs the automated test suite, posts a comment on the pull request reporting the result, and merges it automatically the moment the tests pass, with no click from the user at any point.

Revised 2026-07-16, after the first version of this spec (which used GitHub's native "Enable auto-merge" toggle, requiring the user to arm it once per pull request) was approved and partially built. The user pointed out that arming a toggle per pull request is barely less manual than clicking merge directly, since it still requires opening the pull request and acting on it. The actual goal, stated plainly, is "I don't have to physically see things and push, if all major tests pass then merge", which only a workflow that merges on its own actually satisfies.

This also reverses an earlier decision. The Phase 0 and Phase 1 design explicitly ruled out an automated test suite, verification was manual only. For CI to be a meaningful gate rather than a formality, that non-goal is dropped. A real pytest suite is introduced, starting with the data already on `main` from Phase 0, and extended as Phase 1 code is rebuilt.

## Goals

- A GitHub Actions workflow that runs the pytest suite on every pull request targeting `main`.
- A pytest suite under `backend/tests/` covering the Phase 0 mock data (`cards.json`, `offers.json`, `transactions.json`) and the Phase 1 and Phase 2 tool functions.
- The same workflow posts a comment on the pull request reporting whether tests passed or failed.
- The same workflow merges the pull request automatically (squash, delete branch) the moment the tests pass, with no action from the user. If tests fail, nothing merges.
- Branch protection on `main`: no direct pushes, a pull request is required.
- All GitHub Actions used (`actions/checkout`, `astral-sh/setup-uv`) and all Python dependencies pinned at their latest available release as of 2026-07-16, confirmed directly against the GitHub Releases API and PyPI rather than assumed.

## Non goals

- No linting (ruff or otherwise). Not requested, would be scope creep here.
- No use of GitHub's native "Enable auto-merge" toggle. The first version of this spec used it, the user pointed out it still requires opening the pull request and clicking something, which does not meaningfully reduce manual effort. Superseded by the workflow merging on its own.
- No required status check on branch protection gating the merge. The merge happens from within the same job that runs the tests, so by the time the merge step runs, the check itself has not yet reported as completed to GitHub, a required check would be evaluated as still pending and could block the very merge that only runs after the tests already passed inside that job. Branch protection here only enforces "pull requests only, no direct pushes"; the workflow's own `if: success()` step is what actually gates the merge on tests passing. See Risk and confirmation below for the full reasoning.
- No changes to deployment. This is CI only, not CD in the sense of shipping to Render or Netlify, those arrive in Phase 8.
- Opening the pull request itself is the user's action, not something this spec automates. This spec starts from an already open pull request.

## Components

### 1. `.github/workflows/ci.yml`

Triggers on `pull_request` events targeting `main`. Two jobs, following least privilege: the token has no write access anywhere it does not need it.

- `test`: default read only `GITHUB_TOKEN`, no `permissions` block needed. Checks out the repository (`actions/checkout`), installs `uv` (`astral-sh/setup-uv`), runs `uv sync` and `uv run pytest`, both inside `backend/`.
- `merge`: `needs: test`, `if: always()` so it runs regardless of whether `test` passed or failed, decides what to do based on `needs.test.result`. Only this job carries `permissions: contents: write, pull-requests: write`, and it does not check out any code, it only calls the `gh` CLI. On `needs.test.result == 'success'`: comments on the pull request that tests passed, then `gh pr merge --squash --delete-branch`. On `needs.test.result == 'failure'`: comments that tests failed, does not merge.

Both third party actions are pinned to a full length commit SHA, not a mutable tag, with the human readable version kept alongside as a trailing comment (for example `astral-sh/setup-uv@11f9893b081a58869d3b5fccaea48c9e9e46f990 # v8.3.2`). A tag can be repointed by the action's maintainer at any time, a commit SHA cannot, this is a real supply chain protection, not decoration. The SHAs were resolved from the latest available release of each action as of 2026-07-16 via the GitHub API, not copied from memory. This was flagged by an automated security review during development and fixed rather than dismissed.

This only works for pull requests from branches within the same repository, not from forks, since GitHub withholds write permissions from the default token on fork originated `pull_request` events regardless of the `permissions` block, a deliberate GitHub security measure. That restriction is not a problem here, this repository has one contributor and no forks are expected.

### 2. `backend/tests/`

A pytest suite, with `pytest` added as a development dependency via `uv add --dev pytest`.

- `backend/tests/test_data.py`: loads the three JSON files and asserts on their shape and cross references, for example that there are six cards, six offers, twenty four transactions, that every offer's `card_id` refers to an existing card, that every card is referenced by exactly one offer, and that every category used in `transactions.json` and in each card's `reward_rates` is one of the six known categories.
- `backend/tests/test_phase2_tools.py`: already exists from the Phase 2 work, tests the LangChain wrapped tools against Phase 1's raw functions. No new test file is required by this spec.

### 3. Branch protection on `main`

Configured via the GitHub CLI (`gh api`) rather than the web UI, so the exact change is visible and reviewable. Requires: pull requests only, no direct pushes to `main`, no force pushes, no deletions. Deliberately does not require a status check, see the Non goals section for why.

## Workflow after this ships

1. Work happens on a phase branch, as it does today.
2. The user opens a pull request against `main` themselves, this spec does not automate that step.
3. The `ci.yml` workflow runs `pytest` automatically.
4. If tests pass: the workflow comments on the pull request and merges it (squash, branch deleted) immediately, with no action from the user.
5. If tests fail: the workflow comments on the pull request explaining that, and does not merge. The branch stays open for the user to look at and fix.

## Risk and confirmation

Branch protection rules are a change to shared GitHub configuration, not a local file, and will be applied with a `gh api` command shown to the user before it runs, consistent with how any other change to shared infrastructure is handled in this project. Granting `contents: write` and `pull-requests: write` to the default `GITHUB_TOKEN` in the workflow is also worth being explicit about: it means any code merged into a pull request against `main` can, through this workflow, push a merge commit and delete a branch without further human involvement. This is the user's stated intent, not an oversight, recorded here so the trade-off is visible rather than silent.

## Verification

- A pull request opened from a throwaway branch with a passing test triggers the workflow, which comments and merges the pull request automatically.
- A pull request opened from a throwaway branch with a deliberately failing test triggers the workflow, which comments that tests failed and leaves the pull request open, unmerged.
- The branch protection rule blocks a direct push to `main`.

## Open questions

None outstanding. All prior questions in this design conversation have been resolved.
