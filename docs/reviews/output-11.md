# Review request: `output-11`

Review range: `94780dc...feat/output/restart-cooldown`. Check the output window
crash rules against `docs/spec/08-problems.md` ("Output window crash", "The
restart limit"): quick restarts, the empty picture at the limit, the cool-down
of 10, 20, 40, then 60 seconds, one pending and one running attempt, the end of
the limit after a minute alive, and off and on. Then check the output status
that the control window reads (data-10's `output:status:get`,
`output:status:changed`, and `output:retry`) for the 08 cards, the amber
outline, and the status bar frame rate.

- Team member: `output`
- Branch: `feat/output/restart-cooldown`
- Base commit (`main`): `94780dc`
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
  attempt that dies again. An attempt that runs 60 s without dying ends the
  limit and resets the count.
- There is at most one pending and one running attempt. Turning the output on,
  and 다시 시도, cancel the pending cool-down and start an attempt at once;
  while an attempt runs, they do nothing more. Turning the output off stops the
  attempts.
- The renderer state is `running`, `restarting` (a quick reload), or `limited`
  (the limit holds), and it returns to `running` only when the reloaded page has
  drawn the output state. Its first frame rate report is the sign (spec-7 round
  2: the window and its preview show the empty picture until then).

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
- `docs/reviews/output-11.md` (new)

## Checks run

On `11f6c0c`, on `main` at `94780dc`.

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
      element, and object URL is released (the three recovery timers, the status
      channels, and the board's listener)
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
   arrives about a second after the page starts. A dedicated "drawn" message
   would be faster but needs a new channel.
2. The status goes to every window, like the live state. Output windows ignore
   it.
3. The 방송 자막 capture window's chroma background comes with the capture
   method; today every output window's native background is black.

## Shared contract change requests

None.

## Where to look

- `src/main/outputs/rendererRecovery.ts`: `crashed`, `pageDrawn`, `retry`, and
  the limit phases.
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

1.
