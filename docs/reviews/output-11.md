# Review request: `output-11`

Review range: `1d46613...feat/output/restart-cooldown` (round 3). For round 3,
check the two round 2 findings in "Team member's reply", fixed in `118abb6`
(`pageLoad.ts` and `rendererRecovery.ts`). The round 1 fixes, rebased, are
`5e33204` (failed or undrawn loads, retries while off), `5072e7d` (the frame
rate report only after the first live state is drawn), and `e2c9dc1` (tests).
Check the output window crash rules against `docs/spec/08-problems.md` ("Output
window crash", "The restart limit"): quick restarts, the empty picture at the
limit, the cool-down of 10, 20, 40, then 60 seconds, one pending and one running
attempt, the end of the limit after a minute alive, and off and on. Then check
the output status that the control window reads (data-10's `output:status:get`,
`output:status:changed`, and `output:retry`) for the 08 cards, the amber
outline, and the status bar frame rate.

- Team member: `output`
- Branch: `feat/output/restart-cooldown`
- Base commit (`main`): `1d46613` (round 3; round 2 was on `4e2501e`, round 1 on
  `94780dc`)
- Last commit: the commit that adds this file
- Related: the lead's restart-limit rule; spec-7 (08 and 04); data-10's channels

## Changes outside my paths

None. The channels, the snapshot type, and its parser are data-10's, on `main`.

## What changed and why

**The restart rules (`rendererRecovery.ts`).** output-1 stopped restarting an
output window after 3 crashes in 60 seconds and left it with a dead renderer.
`RendererRecovery` replaces that:

- A crash reloads the page after 100 ms, and the reason and exit code are
  logged. The window shows its native background (black) meanwhile.
- After 3 crashes in 60 seconds, the restart limit holds: the window stays shown
  at its place with the empty picture, the limit is logged at error level, and
  an attempt follows after a cool-down of 10 s, then 20, 40, and 60 s for each
  attempt that fails again. An attempt that runs 60 s after it draws ends the
  limit and resets the count.
- A reload fails like a crash when its page doesn't load (the load is rejected)
  or doesn't draw within 10 s: a quick reload counts toward the limit, and an
  attempt goes back to the cool-down. Each reload is one `PageLoad` that settles
  once, and a failure counts only while the page is live or loading, so one
  failed page never counts twice. A page that draws after its load counted as
  failed is kept: the pending reload is dropped and the survival minute starts.
  A frame rate report from a page that crashed is ignored. While the output is
  off, a page has no time limit to draw; turning it on gives it the full 10 s.
- There is at most one pending and one running attempt. Turning the output on,
  and 다시 시도 while it is on, cancel the pending cool-down and start an
  attempt at once; while an attempt runs, they do nothing more. Turning the
  output off stops the attempts, and 다시 시도 does nothing until it turns on
  again.
- The renderer state is `running`, `restarting` (a quick reload), or `limited`
  (the limit holds), and it returns to `running` only when the reloaded page has
  drawn the output state. Its first frame rate report is the sign (spec-7 round
  2: the window and its preview show the empty picture until then). The output
  page starts its frame rate meter only after it has drawn the first live state,
  so a report always means the state is on screen.

**The output status (`statusBoard.ts`, `start.ts`).** `OutputStatusBoard` builds
data-10's `OutputStatuses` from the manager (each screen's placement and
renderer state) and the frame rate tracker (`fps`, `null` while off, and
`fpsLow`). It announces a new snapshot only when something changed: a placement,
a renderer state, or a frame rate report. `startOutputs` answers
`output:status:get` with the current snapshot, sends `output:status:changed` to
the windows on every change, and passes a validated `output:retry` to the
manager. `ipc.ts` gains `sendToWindows` (the live state push now uses it too)
and `answerWindows`.

## Changed files

- `src/main/outputs/rendererRecovery.ts` (new), `statusBoard.ts` (new), and
  their tests
- `src/main/outputs/outputWindow.ts`, `manager.ts`, `electronWindow.ts`,
  `start.ts`, `testing.ts`, and tests
- `src/main/rendererMessages.ts`, `src/main/ipc.ts`, and tests
- `src/main/windows/page.ts` (`startLoading`),
  `src/renderer/src/output/startOutput.ts`, and its test (round 2)
- `docs/reviews/output-11.md` (new)

## Checks run

Round 3: `npm run verify` passed on `118abb6`, on `main` at `1d46613`: 5 steps
in 237.1 s. New round 3 tests: `pageLoad.test.ts` (one failure for a rejection
or a missed draw limit, a rejection after the draw limit ignored, nothing heard
once settled, the limit stopped and started again); `rendererRecovery.test.ts`
(an attempt whose load is rejected after it crashed counts once and the next
cool-down is 20 s; a rejection after the draw limit and before the quick
relaunch is ignored; a crash of a page whose failed attempt already counted
counts once; a page that draws during the cool-down is kept and ends the limit a
minute later; a page that draws before its quick relaunch is kept; a report from
a crashed page is ignored).

Round 2: `npm run verify` passed on `a242a71` (now `e2c9dc1`), on `main` at
`4e2501e`: 5 steps in 181.6 s. New round 2 tests: a quick reload whose load is
rejected reloads again; an attempt whose load is rejected goes back to the
cool-down and a later attempt ends the limit; an attempt that doesn't draw in 10
s fails; quick reloads that never draw reach the limit; the limit ends only a
minute after the draw; a replaced load's rejection is ignored; a hidden page has
no draw limit; 다시 시도 while off starts nothing until the output turns on; the
output page reports no frame rate while the live state is on its way or never
arrives; a failed page load reaches the recovery through the Electron handle.

Round 1, on `11f6c0c`, on `main` at `94780dc`:

| Command or test  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Passed, 5 steps in 133.8 s: typecheck, lint, format check, tests with coverage, build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| New tests        | `rendererRecovery.test.ts`: quick reloads with the reason and exit code logged; the limit; waits of 10, 20, 40, 60, 60 s; the live picture back once an attempt draws and the limit ended after a minute; an attempt that dies after drawing; 다시 시도 now but not during an attempt; nothing without a limit; off and on; no timer left; each state change announced once. `statusBoard.test.ts`: the snapshot, no fps while off, change-only announcements, a low rate. `manager.test.ts`: screen states, change notices, retry, and the drawn signal routed to the right screen. `rendererMessages.test.ts`: a valid and four malformed retry requests |
| The real app     | Not run here; qa's harness kills output renderers and can check the limit and the cool-down                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the retry
      request, with data-10's parser)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the three recovery timers, the page
      load's draw timer, the status channels, and the board's listener)
- [x] Caches and lists have size caps (one status per screen)
- [x] An exception in the output path doesn't stop the output
- [x] Only what's needed re-renders (control window): the snapshot goes out only
      when it changed
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: not relevant

## Decisions I made (for the lead to confirm)

1. The first frame rate report after a reload is the sign that the page drew; it
   arrives about a second after the page draws the first live state. A dedicated
   "drawn" message would be faster but needs a new channel.
2. A reloaded page gets 10 s (`DRAW_LIMIT_MS`) to draw. A reload draws in about
   a second (qa measured 1.2 s); 10 s leaves room for a busy machine without a
   long blank screen.
3. The status goes to every window, like the live state. Output windows ignore
   it.
4. The 방송 자막 capture window's chroma background comes with the capture
   method; today every output window's native background is black.

## Shared contract change requests

None.

## Where to look

- `src/main/outputs/rendererRecovery.ts`: `crashed`, `pageDrawn`, `retry`,
  `reload`, `loadFailed`, `countFailure`, the page status, and the limit phases.
- `src/main/outputs/pageLoad.ts`: how a load settles once.
- `src/renderer/src/output/startOutput.ts`, where the meter starts.
- `src/main/outputs/start.ts`, `publishStatus`.

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

Round 1 findings (codex4), all fixed:

1. `rendererRecovery.ts`: a reload that failed without `render-process-gone`
   still ended the limit after 60 s and left the output blank. Fixed in
   `5e33204`: the handle's `reload()` now returns the load promise
   (`startLoading` in `page.ts`), and a rejected load or one that doesn't draw
   within `DRAW_LIMIT_MS` fails like a crash: a quick reload counts toward the
   limit, and an attempt goes back to the cool-down. The survival minute starts
   when the attempt draws, so only a drawn attempt ends the limit. A load id
   ignores the rejection of a load that a newer one replaced. Tests in
   `rendererRecovery.test.ts`, `outputWindow.test.ts`, and
   `electronWindow.test.ts` (`e2c9dc1`).
2. `start.ts`: a frame rate report didn't prove that the live state loaded.
   Fixed in `5072e7d`: the output page starts its frame rate meter only after it
   has drawn the first live state, so the first report means the state is on
   screen. Tests in `startOutput.test.ts` with a delayed and a failed state
   answer.
3. `rendererRecovery.ts`: `retry()` ignored a paused output. Fixed in `5e33204`:
   다시 시도 does nothing while the output is off; turning it on starts one
   attempt. Test: three requests while off start nothing, and resume starts
   exactly one.

From the output-10 review: `ipc.test.ts` now resets `isMaximized` before each
test (`e2c9dc1`).

Round 2 findings (codex4), both fixed in `118abb6`, following the suggestion to
settle each attempt once:

1. `rendererRecovery.ts`: after a crash or a missed draw limit, the load stayed
   current, so its later rejection counted the same attempt again. Each reload
   is now a `PageLoad` (`pageLoad.ts`) that settles exactly once: a rejection, a
   missed draw limit, a draw, a crash, or the next reload settles it, and
   nothing it hears afterwards counts. The recovery also tracks the page
   (`live`, `loading`, `failed`, `gone`), and a failure counts only while the
   page is live or loading, so a crash of a page whose failure already counted
   doesn't count again either. Tests: a rejection after a crash in an attempt, a
   rejection after the draw limit before the quick relaunch, a crash after a
   counted failure.
2. `rendererRecovery.ts`: a page that drew during the cool-down became running
   while the cool-down still reloaded it, and no survival minute started. Now a
   draw from a page that isn't gone drops the pending relaunch or cool-down, and
   during the limit it makes the attempt the running one and starts the survival
   minute. Reports from a crashed page are ignored until the next reload. Tests
   with the fake clock: a draw during the cool-down (no reload, the limit ends a
   minute after the draw), a draw before the quick relaunch, and a report after
   a crash.
