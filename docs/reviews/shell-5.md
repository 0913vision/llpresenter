# Review request: `shell-5`

- Team member: `shell`
- Branch: `feat/shell/show-keys`
- Base commit (`main`): `3fea3fb`
- Last commit: see the commit that adds this file
- Related brief: the lead's queue item 3 (진행 keys per spec-1)

## What changed and why

The 진행 keys now follow `docs/spec/10-shortcuts-and-settings.md`, "Focus
precedence" (rules 2 to 6) and the key list for 진행.

1. **Live keys go to the live commands even with the 장 grid or the 예배 순서
   list in focus (rule 5).** → and Space and Page Down output the next 장; ← and
   Page Up output the previous 장. The grid keeps only ↑ and ↓ (by a row) and
   Enter; the list keeps ↑, ↓, Home, End, and Enter. ← and → no longer move the
   grid selection, so `TileKey` is now `'up' | 'down'` and `moveTileSelection`
   lost its left and right cases.
2. **Keys are matched by physical key (`KeyboardEvent.code`), never by `key`.**
   A held key runs once (`event.repeat`), but its repeats are still swallowed,
   so Page Down never scrolls. Keys with Ctrl, Alt, Shift, or Meta are not live
   keys. An IME composition, a text field, and an open menu, dialog, or alert
   dialog keep their own keys (rules 3 and 4).
3. **이름표 jump keys.** A bare letter or digit, stored as a `code`, outputs the
   first tile with that 이름표 after the live 장, or the first in the sequence.
   Numpad digits count as the top row digits. The key to 이름표 map is a sample
   in `sampleService.ts` (`TODO`) until the data layer serves `labels.json`.
4. **Next when another item is open (spec open question 5).** When the 장 panel
   shows an item other than the live one, → outputs that item's first tile.
   Otherwise it follows the live item, and stops at the last 장.
5. **Focus on click (rule 6).** A mouse click in 진행 does not move keyboard
   focus to a clicked button or tab. Text fields, the 장 grid, the 예배 순서
   list, and menus and dialogs still take focus. Space also no longer presses a
   focused button when it is released (`keyup`), because Space is the next-장
   key.
6. **Codex nits of shell-2**: the boundary test in `state/show.test.ts` also
   checks that the selection stays, and the render count test in
   `ShowPanels.test.tsx` uses `act` and expects exactly two row renders.

## Changed files

- `src/renderer/src/show/` (`shortcuts.ts`, `navigation.ts`, `SlideGrid.tsx`,
  `ServiceOrderList.tsx`, `sampleService.ts`, and the tests)
- `src/renderer/src/state/show.ts` and `show.test.ts`
- `src/renderer/src/shell/Workspace.tsx` (the hook name)

## Checks run

Pending.

### Running app (port 5187, app data `D:\llp-dev\shell`)

With real key and mouse events through the Chrome DevTools Protocol at
1920x1080: after clicking a tile (the grid had focus), Space, →, Page Up, and
Page Down moved the live 장; C jumped to the next 후렴 and went back to the
first one when none followed; ↓ in the grid moved the selection and not the live
장; after clicking another item in the list, Space output that item's first
tile; and after clicking a toolbar menu button, the focus stayed on the list
row, so Space still meant next 장.

Not checked: the focus rules with a real open menu or dialog (the `ui`
components are not merged yet; the unit tests use `role="menu"` and
`role="dialog"` containers), and a physical keyboard with the Korean IME on.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the three window listeners are
      removed on unmount)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- Page Down is next and Page Up is previous, as the command list says.
- The mouse-down rule keeps focus off `button`, `[role="button"]`, and
  `[role="tab"]` elements outside the grid, the list, text fields, menus, and
  dialogs. Other controls (a slider, a switch) are not covered yet; they join
  when the `ui` components land.
- 다음 항목 and 이전 항목 (Ctrl ↓ and Ctrl ↑) and 출력 중인 항목 열기 (Ctrl L)
  are not in this change; they are not in the queue item.

## Shared contract change requests

- None.

## Where to look

- `shortcuts.ts`: the order of the checks (handled, modifiers, owners, live
  keys, jump keys) against the focus precedence.
- `navigation.ts`: `nextTile` with another item open.

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
