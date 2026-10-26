# Review request: `output-36`

- Team member: `output`
- Branch: `fix/output/fullscreen-topmost`
- Base and range: in the review request message.
- Scope: the lead's request after two CI runs failed in
  `src/main/outputs/fullscreenOrder.electron.test.ts` (`win.isAlwaysOnTop()`
  false 100 ms after re-entering full screen): find the cause, fix it in the
  product or the test, no retry.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## Investigation

Job logs need admin rights, so two temporary probes on this branch reported
through their failure annotations (runs 40257801583 and 40262526556; the probe
commits are not in this request).

- Probe 1: six windowed-to-full-screen cycles in the product's order
  (`setFullScreen(true)`, then `setAlwaysOnTop(true)`). `isAlwaysOnTop` read
  true at every sample from 0 to 800 ms; the events came in order resize, move,
  enter-full-screen, always-on-top-changed:true, all within 3 ms.
- Probe 2: six replays of the failing test's exact flow (always on top in full
  screen, behind the control window while still in full screen, leave through
  `WindowPlacement` with `verifyBounds`, 700 ms, back to full screen). Again
  true throughout, and the log shows nothing from our code after the full screen
  placement: no behind-control call, no bounds reapply, since
  `WindowPlacement.fullscreen` clears its pending checks.

Electron reads always on top from the window's real `WS_EX_TOPMOST` bit, so in
the two failing runs something outside our code cleared it on the runner. The
runner can't show what. The risk for a service is real either way: an output
that silently drops below other windows.

## What changed and why

- `OnTopKeeper` (new, `src/main/outputs/onTopKeeper.ts`) owns every deliberate
  always-on-top change of an on-screen output window and remembers the level
  last set. When the window leaves that level, as Electron's
  `always-on-top-changed` reports or as a check every `ON_TOP_CHECK_MS` (3 s)
  finds while the output should be on top (an outside change may fire no event),
  it restores the level once and warns. If it is lost again before the next
  deliberate set, it logs an error and leaves the window alone until then, so it
  never fights the system. Each check reads the level now rather than an event's
  value, so a late event of an earlier set is no loss (a NOTE). One interval per
  output window, only while it should be on top; `hide` releases it and
  `dispose` removes the listener too.
- `electronWindow.ts`: full screen, windowed, capture, and behind-control
  ordering all set the level through the keeper.
- The native test uses the keeper, waits the keeper's check interval before it
  asserts the level after re-entering full screen, prints every always-on-top
  change with its time (`ALWAYS_ON_TOP_CHANGES`) and the keeper's warnings, so a
  future failure annotation shows who changed it and when, and still fails on a
  second loss (the keeper's error).

## Changed files

- `src/main/outputs/onTopKeeper.ts` and its test (new).
- `src/main/outputs/electronWindow.ts` and its test.
- `src/main/outputs/fixtures/fullscreenOrder.mts`.

## Changes outside my paths

None.

## Checks run

| Command or test                                                  | Result                                   |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                              | Pass                                     |
| `npx vitest run src/main/outputs`                                | Pass, 199 tests (the native test skips)  |
| `npx eslint` and `npx prettier --check` on the changed files     | Pass                                     |
| Mutation checks (`.llp/output-36/mutations.log` in the worktree) | 9 mutations, all fail a test             |
| `npm run verify`                                                 | GitHub CI only (see the request message) |

The keeper's tests use a fake window: a loss Electron reports, a silent loss
found at the next check, a second loss that logs an error and stops until the
next set, an output that should not be on top kept off it, a late event of an
earlier set, and the timer's lifecycle. One test runs the output window path: a
full screen output that loses the level gets it back, and a hidden output is
left alone.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI, see the request message)
- [x] `npm run format:check` passes (changed files)
- [x] Every new behavior has unit tests
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every listener and timer is released
- [x] An exception in the output path doesn't stop the output
- [x] The clean code rules and comment rules in `CLAUDE.md` hold
- [x] The change is small and focused

## Decisions I made (for the lead to confirm)

1. One restore per deliberate set, then an error and no further fighting, as the
   lead asked.
2. The check runs only while an output should be on top; an output that should
   stay below the control window is corrected by the event alone.
3. The native test now asserts after the keeper's interval, which is the
   product's guarantee, rather than 100 ms after the set.

## Shared contract change requests

None.

## Where to look

- `onTopKeeper.ts`: `check` and `followChecks`.
- `electronWindow.ts`: every `onTop.set`.

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

Round 1 (codex3, Request changes; the second reviewer, Gemini 4 Argon, through
the lead):

1. codex3: the TSDoc on the test helper's `changeOutside` is gone; the helper's
   name and parameters say it.
2. Gemini 4 Argon, a throwing window in a callback: `check` now runs the window
   calls inside a try. On a throw it releases the keeper (no more checks until
   the next deliberate set) and logs an error, so neither the
   `always-on-top-changed` listener nor the interval lets an exception out, and
   a destroyed window can't log every 3 s. A deliberate `set` still throws to
   its caller, as the direct `setAlwaysOnTop` call did before. Test:
   `isAlwaysOnTop` throws at the check (one error, no timer left, no throw out
   of the timers), then `setAlwaysOnTop` throws while restoring after an event
   (no throw out of the event, a second error, no timer).
3. Gemini 4 Argon, a false loss during full screen entry: `showFullScreen`
   releases the keeper before `enterFullScreen` and sets the level after it (a
   NOTE says why), and the native fixture releases before its
   `setFullScreen(true)`. Test: a full screen output moving to another monitor
   gets an `always-on-top-changed` event with the level off during
   `setFullScreen(false)`; nothing warns and the level is set once, after the
   move.

The three regression tests fail against the previous code
(`.llp/output-36/mutations-r2.log`). The TSDoc grep finds only exported
declarations.
