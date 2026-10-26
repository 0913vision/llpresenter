# Review request: `output-35`

- Team member: `output`
- Branch: `feat/output/timer-text` (on `main` after output-34)
- Base and range: in the review request message.
- Scope: M3-O6b part 2: each window reads main's 타이머 clock, and 소품 text
  draws `{timer:<id>}` tokens with one ticker per window, so main sends nothing
  per second (the M3-O6b plan; the lead's answer 5). The stage layout's 타이머
  element waits for M3-O5.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## Shared contract changes (review first)

- `src/shared/ipc.ts`: the additive channel `live:clock` and
  `LlpApi.live.clock(): Promise<number>`, main's monotonic 타이머 clock.
- `src/shared/schema/timerState.ts`: `parseTimerClockReading`, a finite,
  non-negative epoch-like number.
- `src/preload/index.ts`: `live.clock` through `invokeChecked`, which logs and
  rejects a malformed reading.
- `src/shared/testing/fakeLlpApi.ts`: a default `live.clock`.

## What changed and why

output-34 stamps 타이머 runs on main's monotonic clock (codex4's round 1).
Windows can't read that clock directly, so:

- Main answers `live:clock` with the store's 타이머 clock (`LiveStore.timerNow`,
  the same source that stamps runs) and removes the handler on dispose.
- `MainTimerClock` (renderer) asks once at start and keeps one offset between
  this window's monotonic clock and main's, from the midpoint of the round trip.
  Until the answer, the two processes' time origins stand in; they agree unless
  the computer's clock was corrected between the two starts. After that, neither
  side moves with a clock correction.
- `ScreenFrames` follows `timers.json` and puts the 타이머 list, the live runs,
  and the clock into each frame.
- `fillTimerTokens` replaces each `{timer:<id>}` token with the shared reading
  (output-34's `timerText`); a 타이머 that is gone reads as nothing.
- The props layer fills tokens when it draws, and keeps one `setInterval` (1 s)
  while any shown text has a ticking 타이머 (running, or a clock); it clears the
  interval when none does, when the 소품 comes down, and on dispose (a NOTE). A
  tick, or a redraw of the same 소품 text with a new value, rewrites the shown
  lines in place (`OverlayTextView.replace`, `SlideLayerView.replaceLines`), so
  a value never dissolves every second. New 소품 text still dissolves in.

## Changed files

- `src/renderer/src/render/mainTimerClock.ts`, `timerTokens.ts`, and their
  tests; `timerProps.test.ts` (new).
- `src/renderer/src/render/layers/props.ts`, `overlayText.ts`, `slideLayer.ts`,
  `layer.ts`, `screenFrames.ts`, and their tests.
- `src/renderer/src/output/startOutput.ts` and the output tests.
- `src/main/ipc.ts`, `src/main/live/store.ts`, and the IPC test.
- The shared files listed first, and the preload test.

## Changes outside my paths

- `src/shared/`, `src/preload/` (data): the additive `live:clock` contract
  above, with valid and malformed reading tests.
- `src/renderer/src/show/ScreenPreview.tsx` (shell): pass the clock to
  `ScreenFrames`, so previews draw the same 타이머 values.

## Checks run

| Command or test                                                                         | Result                                   |
| --------------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                                                     | Pass                                     |
| `npx vitest run src/renderer src/main/live src/main/ipc.test.ts src/preload src/shared` | Pass, 2,994 tests in 228 files           |
| `npx eslint` and `npx prettier --check` on the changed files                            | Pass                                     |
| Mutation checks (`.llp/output-35/mutations.log` in the worktree)                        | 9 mutations, all fail a test             |
| `npm run verify`                                                                        | GitHub CI only (see the request message) |

Three mutations survived the first run (a redraw that dissolved, a removed 소품
that kept the ticker, a replace before anything showed); tests now pin each.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI, see the request message)
- [x] `npm run format:check` passes (changed files)
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every interval and IPC handler is released
- [x] Only what's needed re-renders (one interval per window, only while a
      ticking 타이머 shows; ticks rewrite text in place)
- [x] The clean code rules and comment rules in `CLAUDE.md` hold
- [x] The change is small and focused

## Decisions I made (for the lead to confirm)

1. One round trip at window start, with no periodic resync: both clocks are
   monotonic after it, so they don't drift apart by more than the processes'
   clock rates.
2. The interval is 1 s, not aligned to second boundaries, so a shown value can
   lag main's by under a second (the plan's acceptance).
3. A token of a 타이머 that is gone reads as nothing rather than as the raw
   token.

## Shared contract change requests

None beyond the additive changes listed first.

## Where to look

- `mainTimerClock.ts`: the offset.
- `layers/props.ts`: `showText` and `followTicking`.

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
