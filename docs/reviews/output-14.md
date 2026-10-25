# Review request: `output-14`

Review range: `7f11119...feat/output/hang-restart` (round 2). For round 2, check
the lead's three findings and codex4's finding in "Team member's reply", fixed
in `9ad5985`. Check that a visible, running output whose page has drawn and then
stops reporting its frame rate for 5 seconds is pinged, that its renderer is
crashed on purpose only when the page also doesn't answer within 10 seconds, so
the crash path of output-11 (quick reload, restart limit) brings it back, that a
page that answers is only logged, and that hidden, restarting, limited, and not
yet drawn pages are never crashed.

- Team member: `output`
- Branch: `feat/output/hang-restart`
- Base commit (`main`): `7f11119` (round 2; round 1 was on `a6efbbf`)
- Last commit: the commit that adds this file
- Related: the lead's list for output (hang detection after the restart limit);
  output-11 (the crash path it reuses)

## Changes outside my paths

None.

## What changed and why

A renderer can hang without dying: a stuck script or a frozen GPU process leaves
the last picture on the screen, and no `render-process-gone` comes. Output
windows get no input, and Chromium raises Electron's `unresponsive` event from
its input hang monitor, which only runs while input events wait for an answer,
so it may never fire for them. The page reports its frame rate once a second
from the time it has drawn the live state (output-11), so a visible output that
stops reporting has stopped drawing. Not drawing alone doesn't prove a hang, so
the main process asks the page before it acts.

- `HangWatch` (new) counts down `FRAME_SILENCE_MS` (5 s) from each beat. When it
  runs out, it pings the page; with no answer within `ANSWER_LIMIT_MS` (10 s)
  the page counts as hung. A page that answers but still reports no frames is
  reported once per silent stretch and asked again after the next silence.
- The ping is `webContents.executeJavaScript('0')`: it runs on the page's main
  thread, so it answers while the page is busy but alive and never while the
  thread is stuck. It needs no new IPC channel.
- `OutputWindow.frameReported()` (was `pageDrawn`) tells the recovery that the
  page drew, marks the page as drawn since its last load, and beats the watch
  while the output is visible and its renderer state is `running`. Turning the
  output on again starts the watch for a page that has drawn since its last
  load. Hiding the output, a crash, and dispose stop the watch, and a crash
  clears the drawn mark, so hidden outputs, restarting or limited ones, and
  pages that haven't drawn yet are never watched.
- A hung page is logged
  (`output window stopped drawing and answering; restarting its renderer`) and
  its renderer is crashed with the handle's new `crashRenderer()`
  (`webContents.forcefullyCrashRenderer()`). Electron then sends
  `render-process-gone`, and output-11's recovery reloads the page and counts
  the crash toward the restart limit. If a renderer survives the forced crash,
  the watch starts over and tries again.
- A page that answers but draws nothing is logged at warning level
  (`output window answers but reports no frames`) and left alone.
- `OutputManager.pageDrawn` is renamed `frameReported`, and `start.ts` calls it
  from the frame rate channel.

### Covered windows and a sleeping display (lead finding 2)

- Measured here with Electron 44.9.3 in a window that is never shown, so nothing
  appeared on the screen: `requestAnimationFrame` runs at 53 to 60 fps and
  `document.visibilityState` stays `visible`, with `backgroundThrottling` both
  off and on. `executeJavaScript('0')` answers in 1 to 2 ms under the output
  page's CSP, gets no answer while the page runs an endless loop, and
  `forcefullyCrashRenderer` ends that page.
- Covered window: a page that isn't visible gets no `requestAnimationFrame`
  callbacks (MDN, Page Visibility API), and Chromium tracks native window
  occlusion on Windows. Since Electron 28 (electron#38924),
  `backgroundThrottling: false`, which every output window sets, also keeps the
  compositor drawing "for the whole window". So a covered output should keep its
  frame loop. I couldn't check a covered window without showing one on the
  screen; qa can check it in the built app by covering a windowed output with
  another window and watching its frame rate.
- Display asleep: Chromium's Windows vsync thread waits for the monitor's
  vblank. When the monitor sleeps or is unplugged, the wait returns at once, and
  the thread sleeps one refresh interval instead (`ui/gl/vsync_thread_win.cc`),
  so frames keep coming on a timer. The app also keeps the display awake while
  any output is on (output-5).
- Either way, a page whose frame loop stops while its main thread still answers
  is now logged, never crashed.

Sources:
[electron#38924](https://github.com/electron/electron/commit/2190793fe6351e50940dec077907eaac1f16471c),
[vsync_thread_win.cc](https://chromium.googlesource.com/chromium/src/+/refs/tags/77.0.3865.78/ui/gl/vsync_thread_win.cc),
[render_widget_host_impl.cc](https://chromium.googlesource.com/chromium/+/HEAD/content/browser/renderer_host/render_widget_host_impl.cc),
[Page Visibility API](https://developer.mozilla.org/docs/Web/API/Page_Visibility_API).

## Changed files

- `src/main/outputs/hangWatch.ts` (new) and its test
- `src/main/outputs/outputWindow.ts`, `manager.ts`, `electronWindow.ts`,
  `start.ts`, `testing.ts`, and tests
- `docs/reviews/output-14.md` (new)

## Checks run

Round 2: `npm run verify` passed typecheck, lint, format check, and build; tests
with coverage had 2,041 passing and 1 failing, the known failure on `main` since
devops-13 (`scripts/soak/media.test.ts`, "ends the stalled maker and every
process it started"), which devops-17 fixes, on `9ad5985`, on `main` at
`7f11119`. New round 2 tests: `hangWatch.test.ts` (a page that never answers is
hung after the silence and the limit; a slow page answering 1 ms inside the
limit never is; a page that answers but stays silent is reported once per silent
stretch and asked again; a failed ping counts as no answer; an answer after the
limit is ignored; stop leaves no timer); `outputWindow.test.ts` (a page that
stops reporting and answering is crashed after 15 s; a slow renderer that
answers is never crashed; a page that answers but reports no frames is logged,
not crashed; a page that drew before and hangs while hidden is crashed after its
output turns on again with no reports; a page that hasn't drawn since its load
is never watched); `electronWindow.test.ts` (the ping runs a script on the page,
a failed ping rejects, a forced crash only while the window exists).

Round 1, on `1f52f19`, on `main` at `a6efbbf`:

| Command or test  | Result                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify` | Passed, 5 steps in 193.6 s: typecheck, lint, format check, tests with coverage, build                                                                                                                                                                                                                                                                                                            |
| New tests        | `hangWatch.test.ts`: a beat starts the countdown over, the callback after the timeout, nothing after stop. `outputWindow.test.ts`: a visible output that stops reporting gets one forced crash after 5 s and none while reports come; a renderer that survives the forced crash gets another after 5 s, and none after its crash arrives; a hidden output and a restarting one are never watched |
| The real app     | Not run here; qa's harness can hang an output page (an endless loop in its console) and check the restart                                                                                                                                                                                                                                                                                        |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes, except the known `main` failure above
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (frame rate
      reports, as before)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the watch's two timers stop on hide,
      crash, and dispose, and a late answer is ignored)
- [x] Caches and lists have size caps (no change)
- [x] An exception in the output path doesn't stop the output (a hung page is
      now restarted, and a busy one is left alone)
- [x] Only what's needed re-renders (control window): not touched
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: not relevant

## Decisions I made (for the lead to confirm)

1. 5 s without a report starts the check, and 10 s without an answer counts as
   hung (proposal), so a hung output is restarted 15 s after its last frame.
   `docs/spec/08-problems.md` has no rule for a hung output yet; the lead
   records it in `docs/decisions.md`.
2. A forced crash counts toward the restart limit like any crash, so a page that
   keeps hanging ends at the limit with the empty picture instead of being
   killed again and again.
3. The ping is `executeJavaScript` rather than `unresponsive` or a new IPC
   channel: it works for a window without input and needs no shared contract.
4. The first load of a window isn't watched until it draws; the first-draw limit
   follows in a small branch after this one merges (the lead's finding 3).

## Shared contract change requests

None.

## Where to look

- `src/main/outputs/hangWatch.ts`.
- `src/main/outputs/outputWindow.ts`, `frameReported`, `show`, `watchIfRunning`,
  and `handleHang`.

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

Round 1 findings, all fixed in `9ad5985` except the lead's third, which follows
after this merges:

1. Lead 1, false positives: a frame silence alone no longer crashes a renderer.
   After `FRAME_SILENCE_MS` (5 s) the main process pings the page's main thread
   with `executeJavaScript`, and only a page that doesn't answer within
   `ANSWER_LIMIT_MS` (10 s) is crashed. A page that answers but reports no
   frames is logged once per silent stretch and never crashed. I chose the ping
   over `unresponsive`, because Chromium raises that event only while input
   events wait for an answer, and output windows get no input. Tests: a slow
   renderer answering 1 ms inside the limit is never crashed; a page that
   answers but reports no frames is logged, not crashed.
2. Lead 2, covered windows and a sleeping display: see "Covered windows and a
   sleeping display" above. With `backgroundThrottling: false` the frame loop
   should keep running in both cases; the covered case still needs a check in
   the built app.
3. Lead 3, the first load: a first-draw limit that reuses output-11's
   `DRAW_LIMIT_MS` comes in a small branch after this one merges.
4. codex4, `outputWindow.ts:153`: turning an output on again now starts the
   watch when its page has drawn since its last load and its renderer is
   running, so a page that hung while hidden is restarted. A page that hasn't
   drawn since its load stays exempt. Fake-clock test: a page that drew, hung
   while hidden, and sends no reports after its output turns on again is crashed
   15 s later.
