# Review request: `output-37`

- Team member: `output`
- Branch: `feat/output/monitor-numbers`
- Base and range: in the review request message.
- Scope: M3-O9b, the 모니터 번호 표시 part (`monitors.identify`): one number
  window per monitor for 3 seconds, with the look the lead decided on
  October 26. The edge margin, the position fine-tuning, and the test pattern
  follow in later requests.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## What changed and why

- `monitors.identify` (`src/main/live/slices/monitors.ts`, new) changes no live
  state. It defers to a `MonitorNumbersPort` that the outputs side connects, as
  `screen.settings.apply` does with its port. With no port connected, the
  command is skipped as failed ('Monitor numbers are not ready').
  `LiveStore.connectMonitorNumbers` returns a release that only clears its own
  connection.
- `MonitorNumbers` (`src/main/outputs/monitorNumbers.ts`, new) places one 240 x
  240 DIP square per monitor with `numberSpots`: the centre, or else the first
  corner 48 DIP in from the edges that covers no shown 방송 자막 capture window;
  a monitor with no free spot shows no number. It closes them all after
  `MONITOR_NUMBER_MS` (3 s) with one timer. Pressing again while they show keeps
  the same windows and starts the 3 s over, unless a spot changed (monitors,
  numbers, or capture windows), in which case it closes them and opens new ones.
  A window that fails to open or close is logged and skipped, so one bad monitor
  never stops the others. `dispose` closes all and clears the timer.
- `openNumberWindow` (`src/main/outputs/numberWindow.ts`, new) opens one
  borderless window at the spot's bounds: not focusable, out of the taskbar,
  clicked through, always on top at the `screen-saver` level (above the output
  windows), sandboxed, with navigation blocked. It shows with `showInactive`
  once its page is ready, never if it was closed first. `close` destroys it
  once.
- Capture areas: `OutputWindowHandle.bounds()` reads where the native window is
  now (`getBounds()`, null when destroyed or offscreen), so an operator-moved
  capture window is avoided where it is. `OutputWindow.captureArea()` returns it
  only for a shown capture output, and `OutputManager.captureAreas()` collects
  them.
- `startOutputs` connects the numbers to the store and disposes them on stop. In
  offscreen mode (`LLP_TEST_WINDOWS=offscreen`) it opens nothing, so no test or
  local run shows a window (a NOTE).
- The output entry draws the number page when the `monitor-number` query is
  present: `showMonitorNumber` draws only a number from 1 to 99, centred, in
  `--text-on-fill` on `--output-black`, `--font-ui` at 160 px, weight 700 with
  tabular figures, the weight the 화면 설정 display layout box draws its number
  with. No token sizes the window yet (a NOTE in the CSS).
- Spec 06, 모니터 번호 표시: the look, marked "(lead decision, October 26; no
  board draws it)", the corner rule, and the repeat press (both proposals).

## Changed files

- `src/main/live/slice.ts`, `src/main/live/store.ts`,
  `src/main/live/slices/monitors.ts` (new) and `src/main/live/monitors.test.ts`
  (new).
- `src/main/outputs/monitorNumbers.ts`, `numberWindow.ts` (new) and their tests.
- `src/main/outputs/electronWindow.ts`, `outputWindow.ts`, `manager.ts`,
  `testing.ts`, `start.ts` and their tests.
- `src/renderer/src/output/main.ts`, `monitorNumber.ts`,
  `monitorNumber.module.css` (new) and `monitorNumber.test.ts` (new).
- `docs/spec/06-settings.md`.

## Changes outside my paths

- `src/main/live/` (the live store): the additive `MonitorNumbersPort`, its
  connect method, and the `monitors.identify` slice, the same shape as the
  `screen.settings.apply` port. The command and its schema were already in
  `src/shared/` (data); nothing shared changed.

## Checks run

| Command or test                                                                    | Result                                   |
| ---------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                                                | Pass                                     |
| `npx vitest run src/main/outputs src/main/live src/renderer/src/output src/shared` | Pass, 1589 tests (the native test skips) |
| `npx eslint` and `npx prettier --check` on the changed files                       | Pass                                     |
| Mutation checks (`.llp/output-37/mutations.log` in the worktree)                   | 33 mutations; all but one fail a test    |
| `npm run verify`                                                                   | GitHub CI only (see the request message) |

Five mutations survived the first run and fail a test since the commits that pin
them (the log shows both runs). The surviving mutation drops `this.disposed ||`
from `captureArea`. It is equivalent: `dispose` clears the handle, so the area
is null either way. The check stays to match the other shown-window methods.

Tests: placement (centre, corner, no free spot), the 3 s close, a repeat press
that keeps the windows, new windows when monitors or numbers change, a reopen
after the numbers closed, logged open and close failures, the window options and
focus-free show, a window closed before its page was ready, the page's input
check, the slice through the store with and without a port, the identity-safe
release, capture areas of shown, moved, hidden, and disposed windows, and the
wiring: three monitors with a capture window, no window offscreen, and every
number window closed when the outputs stop.

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

1. When the centre would cover a capture window, the number moves to the first
   free corner, and a monitor with no free corner shows no number, rather than
   drawing over the capture area.
2. A repeat press keeps the windows and restarts the 3 s; it reopens them only
   when a spot changed.
3. Weight 700, the 화면 설정 display box number's weight, since no token names a
   numeric weight.
4. The number windows sit at the `screen-saver` level, above output windows that
   are always on top.

## Shared contract change requests

None.

## Where to look

- `monitorNumbers.ts`: `numberSpots` and `identify`.
- `numberWindow.ts`: the window options and the show.
- `outputWindow.ts`: `captureArea`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (d3df4373): reviewer (Codex, codex3) Approve, no findings. Lead
  Approve after reading the output-path code (one external reviewer plus the
  lead, user decision of October 26): every window call is guarded and logged,
  the timer is cleared on a repeat press and on dispose, the windows never take
  focus and pass clicks through, and a monitor whose every spot covers a shown
  capture window shows no number. The look in spec 06 is the lead's decision.
  Rebased by the lead onto local `main` without conflicts; typecheck passes.
  This is the 모니터 번호 표시 part of M3-O9b; the edge margin and offset
  (output-38) and the test pattern remain.

## Team member's reply

1.
