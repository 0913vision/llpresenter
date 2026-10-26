# Review request: `screens-3`

- Team member: `screens`
- Branch: `feat/screens/display-layout-panel`, stacked on `screens-2`
- Base commit (`main`): `4fe8bab3`
- Last commit: see the request line
- Related brief: `docs/briefs/screens.md`

## What changed and why

M3-O1 part 2, second request: the display layout and 모니터 번호 표시, in the
center column panel `배치` of 화면 설정 (spec 06, "Display layout").

- One box per monitor, placed like the Windows arrangement and sized by its
  resolution. Each box shows the monitor number (large and faint), the screens
  that show full screen on it, the resolution, and the monitor name. The monitor
  that holds the main window reads `컨트롤`. The monitor of the selected screen
  is highlighted.
- A separate group lists the screens without a monitor (capture window, window,
  NDI) with their resolution, and highlights the selected one.
- The button `모니터 번호 표시` sends the `monitors.identify` command (output's
  O9b draws the numbers).
- Monitors arrive through `window.llp.monitors` from screens-2 and release their
  subscription on unmount; a failed read is logged.

Not in this request: assigning a monitor by dragging a screen onto a box or by
the 장치 select. Both write `screens.json` and belong with the properties
request (part 4), where the 장치 select and the one-screen-per-monitor rule are
built once.

## Changed files

- `src/renderer/src/screens/`: `DisplayLayout.tsx`, `DisplayLayout.module.css`,
  `layoutBoxes.ts`, `monitorAssignment.ts`, `displaySizes.ts`, `selection.ts`
  (`selectedScreenIn`), `useMonitors.ts`, and their tests.
- Changes outside my paths:
  - `src/renderer/src/shell/Workspace.tsx` (shell's path), one `case '배치'` in
    `screensPanelParts` and its import.
  - `src/shared/monitorAssign.ts` (new) holds main's `assignMonitors`, moved
    from `src/main/displays/assign.ts` and made generic over the monitor type;
    `assign.ts` now re-exports it, so main's callers and `assign.test.ts` are
    unchanged (output's path).
  - `src/shared/schema/monitors.ts` and `src/main/displays/monitorList.ts`: the
    monitor gets its display `id` (additive), with tests.

## Checks run

| Command or test                         | Result               |
| --------------------------------------- | -------------------- |
| `npm run typecheck`                     | Passes               |
| `eslint` on the screens folder          | Clean                |
| `vitest` on the screens and shell tests | Pass                 |
| `npm run format:check`                  | Passes               |
| GitHub CI                               | See the request line |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI run in the request)
- [x] `npm run format:check` passes
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated (the bridge parses the list)
- [x] No `any`, no bypassing type assertions, and no `!`
- [x] Every subscription is released (tested)
- [x] Colors, sizes, and spacing use design tokens; the box positions are
      percentages computed from the monitor bounds
- [x] Not in the output path

## Decisions and open points

1. The layout is a pure function (`layoutBoxes.ts`) from the monitor list, the
   screens, and the selected screen, so the rules are tested without the DOM.
2. A full screen belongs to the monitor whose number its saved `display.number`
   names. A screen with no saved monitor appears in no box and not in the
   targets, as its list row says `모니터 미지정`.
3. The design system has no display layout component, so the boxes use panel
   tokens (`--bg-well`, `--line-strong`, `--selection`, `--ring-selected`). If
   ui adds a component later, only `DisplayLayout.module.css` changes.

## Shared contract change requests

None.

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

## Round 2 reply

1. [P2] Saved monitor numbers: the panel now resolves each screen's monitor with
   main's own `assignMonitors` (moved to `src/shared/monitorAssign.ts`), from
   the saved display id first, then name and size, then position and size. The
   monitor list carries the display `id` for this. Tests renumber the monitors
   and check a missing monitor.
2. [P2] Resolution: bounds stay in device-independent pixels for the
   arrangement, and the label is converted with the scale factor. A test covers
   a 200 % monitor (`3840×2160`).
3. [P2] Initial selection: `selectedScreenIn` is the one rule for the screen
   list and this panel (the picked screen, else the first 청중 screen, else the
   first screen, also after the picked one is removed). A workspace test covers
   the initial mark and the fallback after a removal; the boxes carry
   `aria-current`.
4. [Nit] A capture screen without a saved resolution shows 1920×1080, the size
   its window opens with. A window shows 960×540.

Windows can't read the monitor each screen had at main's last assignment, so a
look-alike monitor is the one case where the panel may differ from main (then
main leaves the screen in a window); the NOTE in `monitorAssignment.ts` says so.
