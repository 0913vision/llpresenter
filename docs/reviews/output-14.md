# Review request: `output-14`

Review range: `a6efbbf...feat/output/hang-restart`. Check that a visible,
running output whose page stops reporting its frame rate for 5 seconds gets its
renderer crashed on purpose, so the crash path of output-11 (quick reload,
restart limit) brings it back, and that hidden, restarting, and limited outputs
are never watched.

- Team member: `output`
- Branch: `feat/output/hang-restart`
- Base commit (`main`): `a6efbbf`
- Last commit: the commit that adds this file
- Related: the lead's list for output (hang detection after the restart limit);
  output-11 (the crash path it reuses)

## Changes outside my paths

None.

## What changed and why

A renderer can hang without dying: a stuck script or a frozen GPU process leaves
the last picture on the screen, and no `render-process-gone` comes. Output
windows get no input, so Electron's `unresponsive` event may never fire for them
either. The page reports its frame rate once a second from the time it has drawn
the live state (output-11), so a visible output that stops reporting has stopped
drawing.

- `HangWatch` (new) counts down 5 s (`HANG_TIMEOUT_MS`) from each beat and calls
  back when the countdown runs out.
- `OutputWindow.frameReported()` (was `pageDrawn`) still tells the recovery that
  the page drew, and beats the watch while the output is visible and its
  renderer state is `running`. Hiding the output, a crash, and dispose stop the
  watch, so hidden outputs and restarting or limited ones are never watched.
- When the countdown runs out, the window logs
  `output window stopped drawing; restarting its renderer` and calls the
  handle's new `crashRenderer()` (`webContents.forcefullyCrashRenderer()`).
  Electron then sends `render-process-gone`, and output-11's recovery reloads
  the page and counts the crash toward the restart limit, so a page that hangs
  again and again ends at the limit like one that crashes.
- If a renderer survives the forced crash, no `render-process-gone` comes, so
  the watch starts over and tries again after another 5 s.
- `OutputManager.pageDrawn` is renamed `frameReported`, and `start.ts` calls it
  from the frame rate channel.

## Changed files

- `src/main/outputs/hangWatch.ts` (new) and its test
- `src/main/outputs/outputWindow.ts`, `manager.ts`, `electronWindow.ts`,
  `start.ts`, `testing.ts`, and tests
- `docs/reviews/output-14.md` (new)

## Checks run

On `1f52f19`, on `main` at `a6efbbf`.

| Command or test  | Result                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify` | Passed, 5 steps in 193.6 s: typecheck, lint, format check, tests with coverage, build                                                                                                                                                                                                                                                                                                            |
| New tests        | `hangWatch.test.ts`: a beat starts the countdown over, the callback after the timeout, nothing after stop. `outputWindow.test.ts`: a visible output that stops reporting gets one forced crash after 5 s and none while reports come; a renderer that survives the forced crash gets another after 5 s, and none after its crash arrives; a hidden output and a restarting one are never watched |
| The real app     | Not run here; qa's harness can hang an output page (an endless loop in its console) and check the restart                                                                                                                                                                                                                                                                                        |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (frame rate
      reports, as before)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the watch's timer stops on hide,
      crash, and dispose)
- [x] Caches and lists have size caps (no change)
- [x] An exception in the output path doesn't stop the output (a hung page is
      now restarted)
- [x] Only what's needed re-renders (control window): not touched
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: not relevant

## Decisions I made (for the lead to confirm)

1. 5 s without a report counts as hung (proposal). Reports come once a second,
   so 5 s rides out a few slow frames or a short GC pause without leaving a
   frozen picture on the screen for long. `docs/spec/08-problems.md` has no rule
   for a hung output yet; spec could add this one under "Output window crash".
2. A forced crash counts toward the restart limit like any crash, so a page that
   keeps hanging ends at the limit with the empty picture instead of being
   killed every 5 s.
3. The first load of a window isn't watched: the watch starts with the first
   report. A first page that never draws stays as it is, as today. Covering it
   would need a first-draw limit like output-11's `DRAW_LIMIT_MS`; I can add it
   in a follow-up if you want it.

## Shared contract change requests

None.

## Where to look

- `src/main/outputs/outputWindow.ts`, `frameReported` and `handleHang`.
- `src/main/outputs/hangWatch.ts`.

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
