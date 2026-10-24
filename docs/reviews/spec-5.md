# Review request: `spec-5`

- Team member: `spec`
- Branch: `docs/spec/decided-shortcuts`, from `main` (not stacked)
- Base commit (`main`): `3afbb50`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's message of October 25 (M3-W1, second part)

## What changed and why

The shortcut part of `docs/spec/10-shortcuts-and-settings.md` was decided on
2026-10-25 and merged with spec-1. The spec files it replaces or narrows still
stated the old proposals or pointed at 10 as a proposal. This change writes the
decided rule into each of them, following 10's "Rules this precedence replaces
or narrows" table and its command list. Settings stay as they were, because the
settings part of 10 is still open.

| File             | Change                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `04-show.md`     | The 장 panel "Keyboard": ↑ ↓ and Enter for the focused grid, → Space Page Down and ← Page Up for next and previous, the rule for → when another item is open, nothing on the last tile (with the open setting noted), key repeat, and the click focus rule. The 예배 순서 list: live keys pass through, Ctrl ↓ and Ctrl ↑. "Keyboard summary for 진행" rewritten with every live default and its basis. |
| `03-output.md`   | Ctrl 1 and Ctrl 2 are decided (ProPresenter's toggles). F1 to F7 work everywhere except the recording key field. Ctrl Z is the clear undo in 진행 and 화면 설정 and the edit undo in 준비 and text fields. Look keys point to 10.                                                                                                                                                                       |
| `01-concepts.md` | Physical-key matching and English key names. F1 to F7 and clear undo per workspace. The 환경설정 window row points to 06 and 10.                                                                                                                                                                                                                                                                        |
| `02-data.md`     | `labels.json` `.key` is a `code` string; jump keys start empty (decided). `shortcuts.json` stores `{code, mods}` bindings, keeps unknown command IDs, and drops invalid bindings.                                                                                                                                                                                                                       |
| `05-prep.md`     | Undo and redo keys (Ctrl Y and Ctrl Shift Z), Ctrl Enter and Ctrl Shift N in the song editor, and the jump key row (physical key, no collision with commands).                                                                                                                                                                                                                                          |
| `06-settings.md` | "Shortcuts" now describes the 단축키 page with the decided rules (reset confirmation, the 이름표 group, per-object rows, reserved keys, conflicts) and points to 10 for focus precedence and the command list. The old "Where shortcuts work" and "Default shortcuts" lists are gone.                                                                                                                   |
| `07-macros.md`   | 매크로 tile keys apply to keyboard focus only; a click doesn't give focus; each 매크로 can have its own shortcut.                                                                                                                                                                                                                                                                                       |
| `09-later.md`    | The 퀵 실행 shortcut hook points to 10.                                                                                                                                                                                                                                                                                                                                                                 |
| `README.md`      | The reading order row for 10 and the scope row for shortcuts.                                                                                                                                                                                                                                                                                                                                           |

### For ui: design system READMEs that conflict with the decided rules

These are ui's files, so this change doesn't edit them. Each line names the
README, what it says now, and the decided rule (10).

1. `SlideThumbnail` README, Accessibility: "the arrow keys move between
   thumbnails. Enter and Space act as a click." Decided: in 진행, ← → and Space
   go to 다음 장 and 이전 장; the grid keeps ↑, ↓, and Enter (10, focus
   precedence rule 5). 준비 keeps the README's keys.
2. `ClearButton` README, Behavior: "The shortcuts work in the 진행 workspace
   wherever the focus is." Decided: F1 to F7 work in every workspace and in the
   환경설정 window, with dialogs open and in text fields; Ctrl Z is the clear
   undo in 진행 and 화면 설정 and the edit undo in 준비 and text fields (10,
   focus precedence rules 2 to 4).
3. `MacroTile` README, Accessibility: "The arrow keys move between items, and
   Enter or Space runs one." Decided: these apply to keyboard focus only, and a
   mouse click on a tile in 진행 doesn't give it keyboard focus (10).
4. `MediaTile` README, Accessibility (media strip): the same click focus rule as
   `MacroTile` for tiles in 진행.
5. All interactive components used in 진행 (buttons, toggles, segmented
   controls, sliders, tab rows, tiles): a mouse click doesn't move keyboard
   focus; Tab still does; the 장 grid, the 예배 순서 list, and text fields take
   focus on a click (10).
6. `KeyCap` README, Writing: the key names list lacks Page Up, Page Down, Home,
   End, and Delete (decided: English, as Windows writes them).
7. `KeyCap` README, Behavior (key recording field): it should refuse reserved
   keys with the reason in a tooltip (10, "Reserved keys").

## Changed files

The nine files in the table above, and `docs/reviews/spec-5.md` (new).

## Checks run

| Command or test           | Result                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Pass: typecheck 5.1 s, lint 26.9 s, format:check 15.1 s, test:coverage 41.8 s (41 files, 363 tests), build 1.8 s; 90.7 s in all |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                              |

## Decisions I made (for the lead to confirm)

1. Where 10 decided a rule but left a smaller detail as a proposal (previous on
   the first tile, the next occurrence rule for jump keys, Ctrl 1 when only some
   outputs are on), the detail keeps its "(proposal)" mark.
2. The last-장 rule says "does nothing" as decided, and mentions the 환경설정 >
   진행 setting only as part of the open settings proposal.

## Where to look

- That each changed file now states the same rule as 10's command list and focus
  precedence.
- The ui list above.
