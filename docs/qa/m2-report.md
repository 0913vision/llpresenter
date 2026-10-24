# M2 test report

This report will hold the results of the M2 test plan (`docs/qa/m2-plan.md`)
once the lead freezes M2 as the tag `m2`. Before the freeze, it records an early
exploratory pass that the lead asked for.

## Early pass on the 진행 slice

- Build: `main` at `23e0344` (v0.4.1), with shell-2
  (`feat/shell/show-workspace`) on an invented sample service.
- Method: the built app in the invisible QA window, driven over CDP, against
  `docs/spec/04-show.md` and the decided keys of
  `docs/spec/10-shortcuts-and-settings.md`.

### Bugs

| ID   | Severity | Area and owner   | Title                                                 | Build     | State                   |
| ---- | -------- | ---------------- | ----------------------------------------------------- | --------- | ----------------------- |
| M2-1 | minor    | 진행 keys, shell | A held → runs through the song                        | `23e0344` | Fix in review (shell-5) |
| M2-2 | minor    | 진행 keys, shell | The live keys don't follow the focus rules of spec 10 | `23e0344` | Fix in review (shell-5) |

#### M2-1: A held → runs through the song

- Severity: minor (the feature works), with an effect on the output: a held key
  or a presentation remote that repeats skips 장 on the screens.
- Area and owner: `src/renderer/src/show/shortcuts.ts` (shell).
- Steps: Output tile 1 of 아침이 밝아 오네, then send → once and as 5 repeats
  (CDP `keyDown` with `autoRepeat`).
- Expected: One step. Spec 10 decides that live commands ignore repeated
  `keydown` events (`event.repeat`).
- Actual: The live 장 went from position 0 to 3, the end of the 4-tile sample.
- A test that would have caught it: a `keydown` with `repeat: true` doesn't call
  `outputNext`.

#### M2-2: The live keys don't follow the focus rules of spec 10

- Severity: minor.
- Area and owner: `src/renderer/src/show/` (shell).
- Steps and actual results:
  - Page Down and Page Up do nothing. Spec 10: 다음 장 is →, Space, and Page
    Down; 이전 장 is ← and Page Up.
  - With focus in the 장 grid, → and ← move only the selection, and Space
    outputs the selected tile. Spec 10 rule 5: the grid keeps ↑, ↓, and Enter,
    and passes ←, →, Space, Page Up, and Page Down to 다음 장 and 이전 장.
  - With another item open in the 장 panel, → keeps stepping the live item. Spec
    10: 다음 장 then outputs the first tile of the item in the panel.
  - A mouse click on a toolbar button moves keyboard focus to it. Spec 10: a
    click in 진행 moves focus only into text fields, the grid, and the list.
  - Keys are matched by `KeyboardEvent.key`; spec 10 matches
    `KeyboardEvent.code`.
- What works: the list skips headers and Home and End go to the ends; a click on
  a tile outputs it with the live ring on that tile only; Enter in the grid
  outputs; → stops on the last 장 (the lead's decision); the toolbar search
  field keeps ← and Space; the LIVE badge follows the live item.

### Notes, not filed

These are parts of the slice that later shell requests add (shell-6, shell-7) or
that shell takes into a later branch:

- The 장 panel header shows "장" instead of the item name with "2 / 4" or "4장"
  (spec 04).
- F1 to F7 and Ctrl Z don't clear or undo yet.
- 다음 항목 (Ctrl ↓), 이전 항목 (Ctrl ↑), and 출력 중인 항목 열기 (Ctrl L) from
  spec 10 aren't there.
- Tile names read "1 1절 아침이 밝아 오네"; the `SlideThumbnail` README puts a
  comma after the 이름표 ("2 프리코러스, 저 천사여 찬송하세").

### Branches tested before merge

At the lead's request, QA built open branches in its clone and drove them with
the same invisible harness. The results went to the owners as review input.

| Branch                           | Commit    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shell-5 (`feat/shell/show-keys`) | `5e61f69` | M2-1 fixed: a first press moves one 장 and 5 repeats change nothing. M2-2 fixed for Page Down and Page Up, the grid keys, → with another item open (outputs its first tile), clicks that no longer move focus, and `event.code` matching. Left: Space on a Tab-focused button still runs 다음 장 instead of pressing it (spec 10 rule 6); shell fixes it in `fix/shell/button-keys`                                                                                                                                                                                                                                                            |
| data-5 (`feat/data/ipc`)         | `fbc27da` | `window.llp` exists under the sandbox (live, window, ui, log, output; no Node globals; the preload requires only `electron`). Malformed `live.get` and `ui.get` replies, a missing `ui:get` handler, and a malformed `live:changed` broadcast give the defaults or are dropped, each with an "Ignored a bad reply" message on `log:write`. The main handler for `log:write` comes with output-2                                                                                                                                                                                                                                                |
| output-1 (`feat/output/windows`) | `510bc2c` | With a fake second monitor: on and off reuse one window and renderer (20 cycles); the output page reads the live state; a killed renderer comes back in about 1.2 s with the state (recorded against 08's proposed 1 s); a crash while off comes back hidden; restarts stop after 3 crashes in a minute; unplug moves the output to a window on the control monitor and replug brings it back; three failed display reads recover through the 1 s retry; with one monitor, the 본 화면 opens windowed. After the restart limit, the window stays shown (the lead: black background, logged, retried after a cool-down in output's next branch) |

Skipped because they need a visible window, for the M2 run with the user: real
full screen on a second monitor, always on top over other apps, the hidden
cursor over a full screen output, and a real cable unplug.

QA reruns this pass after shell-5 to shell-7 merge.
