# Review request: `qa-3`

Review range: `3329f81...docs/qa/m3-plan`

- Team member: `qa`
- Branch: `docs/qa/m3-plan`
- Base commit (`main`): `3329f81`
- Last commit: see the commit that adds this file
- Related plan: `docs/plans/m3-breakdown.md` (M3-Q1); the lead's request to
  start with wave A, D1a and O0 first

## What changed and why

This change adds the first part of the M3 test plan, `docs/qa/m3-plan.md`, so
that each wave A request can be tested as it merges. No code, configuration, or
dependency changed.

The plan has:

- How QA tests a request: before merge in a scratch clone on request, the unit
  tests read against the breakdown's acceptance criteria (a missing test is a
  finding), after merge on local `main`, and the wave checks.
- E1: `LLP_TEST_WINDOWS=offscreen` (output-10) confirmed on each new build
  before any other app run.
- 46 cases: E (1), RG live registry for O0 (7), CA contracts for 준비 and
  content for D1a (8), CB live command contracts for D1b (3), CC screen and
  recovery contracts for D1c (2), SS app-wide settings stores for D2 (8), SE
  search index for D4 (7), US design system follow-ups for U1 (6), and IA wave A
  integration checks (4), plus the regression set R.

## Changed files

- `docs/qa/m3-plan.md` (new)
- `docs/reviews/qa-3.md` (new)

## Checks run

| Command or test        | Result |
| ---------------------- | ------ |
| `npm run format:check` | Pass   |

Documents only, so only the format check runs (the lead's rule).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Not applicable: documents only. No middle dots or em dashes.

## Decisions I made (for the lead to confirm)

1. **Wave A integration checks of QA's own.** The breakdown has none for wave A,
   so IA1 to IA4 test the wave A requests together: a widened contract on the
   registry, settings edits reaching the windows, search over IPC, and the
   single owner of `app.json` (M1-12).
2. **Observations where the breakdown sets no number.** RG7 (dispatch cost
   within 10%) and SE7 (heap flat within 5%) are recorded as observations, not
   gates, as in the M2 plan.
3. **Missing tests count.** Step 2 of "How QA tests a request" makes an
   acceptance criterion without a unit test a finding.

## Shared contract change requests

None.

## Where to look

- SS1 for the 02 defaults that the settings stores must create.
- SE1 to SE5 against spec 05 "Search".
- IA1 to IA4, which aren't in the breakdown.

## Team member's reply

Round 1 (codex5, Request changes), answered in the commit after `2fd1c20`:

1. SS3 now follows spec 02's rule for app-wide settings: (a) with a readable
   recovery copy the area runs from the newest one, (b) without one from its
   first-launch defaults; the notification detail names which; the area's next
   write first keeps the broken file as `(name).broken-(YYYYMMDD-HHmmss).json`.
   The newer-version case is its own case, SS3b (read-only when it fits the
   schema, the SS3 fallback when it doesn't).
2. RG2 uses O0's fake-slice fixture and dispatches to the registry directly, not
   through IPC. RG3 now separates (a) IPC validation, which drops a type outside
   `LiveCommand` before the registry, from (b) the registry's own rejection of a
   schema-valid type without a slice, each with its log line.
3. CC2 covers D1c's contracts only: the schemas, and the preload's handling of
   fake replies (valid, malformed, wrong type, error). The backend's filtering,
   apply, and start-fresh behavior moves to O8's cases in wave C.
4. US5 lists the key field's outcomes apart: Esc cancels, Backspace alone
   removes, Tab and Shift Tab move focus, all without a tooltip; the other
   reserved keys keep recording with the error ring and the table's tooltip. The
   keys Windows owns can't be sent synthetically and are left to unit tests.

Round 2 (codex4, Request changes), answered in the commit after `626d6c6`:

1. CA8 now checks the agreed surface (typed functions only, every message
   validated, a wrong shape dropped and logged) and no longer asks to hide 준비
   functions from output windows; both windows share one preload API in wave A,
   as the lead decided.
2. Nit: E1 now says that offscreen mode ignores minimize and maximize on
   purpose, and keeps the close and visibility checks.
