# Review request: `output-34`

- Team member: `output`
- Branch: `feat/output/timers`
- Base and range: in the review request message.
- Scope: M3-O6b part 1, 타이머 state in the main process: the live state
  contract, the shared reading, the slice for 시작, 일시 정지, and 처음으로, the
  recovery record exclusion, and spec 04's rules. Part 2 (output-35) draws the
  `{timer:<id>}` token in 소품 text in the output windows.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## Shared contract changes (review first)

- `src/shared/schema/timerState.ts` (new): `TimerRun` is
  `{state: 'running', since, countedMs}` or `{state: 'paused', at, countedMs}`;
  `timerRunsSchema` is a record from `TimerId` to a run, at most
  `MAX_LIVE_TIMERS` (200) entries. Unknown fields are dropped, as for every IPC
  payload.
- `src/shared/schema/liveState.ts` and `src/shared/live.ts`: the additive
  optional `LiveState.timers`. A state without it parses as before; recovery
  records never carry it.
- `src/shared/timerClock.ts` (new): the pure reading that main, the output
  windows, and the 진행 타이머 tab share, like `noticeClock.ts`.

All additive; no existing contract changes.

## What changed and why

Spec 04 "타이머" and the M3-O6b plan ask for 타이머 state in main, with each
window computing the shown value itself, so no message goes out every second.

- A started 타이머 has a run; a stopped one has none. `timer.start` creates or
  resumes a run since the store's `now`, keeping what it counted; `timer.pause`
  folds the running time into `countedMs` and keeps the pause moment;
  `timer.reset` removes the run. A repeated start or pause, a reset of a stopped
  타이머, and a start of a clock change nothing. A 타이머 missing from
  `timers.json` is a missing target, so a batch goes on without it. Past 200
  runs, a new start is refused while the rest of a batch applies.
- All transitions use the store's one clock (`context.now`). `countedMs` never
  goes down: a clock that steps back adds 0, not a negative span (lead decision,
  October 26).
- 타이머 aren't layers, so clears and undo never touch them (tested through
  `layer.clear all` and `clear.undo`).
- `timerText(timer, run, now)` reads a 타이머 as spec 04 now says: "m:ss" under
  an hour, "h:mm:ss" from an hour, a leading "-" past 0, and "HH:mm:ss" for a
  clock. A countdown rounds up, so it reaches "0:00" at its end and "-0:01" a
  second later; an elapsed time rounds down. Wall-clock kinds read today's set
  time in local time; a paused one reads at its pause moment; one that hasn't
  started reads at `now`. `isTimerTicking` tells a window when the value changes
  by itself (running, or a clock).
- The recovery record leaves `timers` out (spec-41).

### Spec 04

The guide (S4) still answered HTTP 522. Renewed Vision's ProPresenter 7 timers
support article (360050782494) says that Start toggles between Start and Stop
for every timer type, that Reset returns a timer to its settings, and that
countdowns run into negative numbers with overrun. Spec 04 now cites it for
those rules. Every other rule is marked "(lead decision, October 26)": every
countdown keeps counting until `timers.json` has the 0 지나면 field of 10;
`countdownTo` and `elapsedFrom` show their value as of the moment they are drawn
before they start (the article is silent on it); the clock reads "HH:mm:ss";
running time never counts backwards.

## Changed files

- `src/shared/schema/timerState.ts`, `src/shared/timerClock.ts`, and their
  tests.
- `src/shared/schema/liveState.ts`, `src/shared/live.ts`.
- `src/main/live/slices/timers.ts` and `src/main/live/timers.test.ts`.
- `src/main/live/recovery/recordWriter.ts` and its test.
- `docs/spec/04-show.md`.

## Changes outside my paths

- `src/shared/` (data): the additive contract and the shared reading above, with
  schema tests in data's style (valid, invalid, the cap at 200 and 201).
- `docs/spec/04-show.md` (spec): the 타이머 rules, cited or marked as lead
  decisions, at the lead's request.

## Checks run

| Command or test                                                  | Result                                   |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                              | Pass                                     |
| `npx vitest run src/shared src/main/live src/preload`            | Pass, 1,327 tests in 75 files            |
| `npx eslint` and `npx prettier --check` on the changed files     | Pass                                     |
| Mutation checks (`.llp/output-34/mutations.log` in the worktree) | 13 mutations, all fail a test            |
| `npm run verify`                                                 | GitHub CI only (see the request message) |

One mutation survived the first run (a second pause moved the pause moment); a
test now pins it.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI, see the request message)
- [x] `npm run format:check` passes (changed files)
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Caches and lists have size caps (200 runs)
- [x] An exception in the output path doesn't stop the output (a refused start
      leaves the rest of a batch)
- [x] The clean code rules and comment rules in `CLAUDE.md` hold
- [x] The change is small and focused

## Decisions I made (for the lead to confirm)

1. A paused run keeps its pause moment (`at`) as well as `countedMs`, so a
   paused wall-clock 타이머 can show the value it had when it paused.
2. A 타이머 deleted from `timers.json` keeps its run until 처음으로 or a
   restart; nothing deletes 타이머 yet (open question in 04). It still counts
   toward the cap.
3. Countdowns round up and elapsed times round down, so each passes 0 at the
   exact second.

## Shared contract change requests

None beyond the additive changes listed first.

## Where to look

- `timerState.ts`: the run shape and the cap.
- `slices/timers.ts`: `start` and its cap check, and `pause`.
- `timerClock.ts`: `readingTime` and the two roundings.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.
