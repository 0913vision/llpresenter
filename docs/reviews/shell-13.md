# Review request: `shell-13`

Review range: 89d0b00...feat/shell/item-keys

What to check: that Ctrl Down, Ctrl Up, and Ctrl L only select or open an item
and never send an output command; that they skip headers, empty slots, and items
without a 장; that a held key may repeat while the 진행 keys still don't; that
the three keys are ignored in text fields, open menus, IME composition, and
during a column drag; and that the grid and list `onKeyDown` handlers no longer
move the selection when Ctrl is held.

- Team member: `shell`
- Branch: `feat/shell/item-keys`
- Base commit (`main`): `89d0b00`
- Last commit: see the commit that adds this file
- Related brief: `docs/spec/10-shortcuts-and-settings.md` (`service.nextItem`,
  `service.previousItem`, `service.revealLive`)

## What changed and why

Spec 10 defines three commands that move through the 예배 순서 without
outputting: open the next item, open the previous item, and open the item of the
live 장. They had no keys yet.

- `navigation.ts`: `adjacentItem` gives the next or previous item that can
  output. It skips headers, slots, and items without a 장. With nothing open,
  next gives the first item and previous gives nothing. `liveItem` gives the
  item of the live 장, or nothing when that item is already open.
- `state/show.ts`: `openNextItem`, `openPreviousItem`, and `revealLiveItem` open
  the target with the existing `openItem`, so the selected 장 resets to the
  first one. `revealLiveItem` keeps the selection when the item is already open.
- `shortcuts.ts`: `ITEM_COMMANDS` maps `ArrowDown`, `ArrowUp`, and `KeyL` with
  Ctrl alone. Keys are matched by `KeyboardEvent.code`, as for the other keys.
  These commands may repeat, because they only select.
- `ServiceOrderList.tsx` and `SlideGrid.tsx`: return early from `onKeyDown` when
  Ctrl, Alt, or Meta is held, so Ctrl Down no longer moves the row or tile
  selection first.

## Changed files

- `src/renderer/src/show/navigation.ts` and `navigation.test.ts`
- `src/renderer/src/state/show.ts` and `show.test.ts`
- `src/renderer/src/show/shortcuts.ts` and `shortcuts.test.ts`
- `src/renderer/src/show/ServiceOrderList.tsx`, `SlideGrid.tsx`, and
  `ShowPanels.test.tsx`

## Checks run

See "Verify result" at the end of this file.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Verify result")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (not touched)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (nothing new is registered)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (no output command
      is sent by these keys)
- [x] Only what's needed re-renders (the commands read the store once per key)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- Ctrl Down at the last item and Ctrl Up at the first item do nothing (no wrap).
- With no item open, Ctrl Down opens the first item that can output.
- `ITEM_COMMANDS` uses thunks (`run: () => openNextItem()`) so tests can spy on
  the state functions.

## Shared contract change requests

- None.

## Where to look

- `shortcuts.ts`: the `isControlOnly` branch in `handleShowKey`, and that the
  existing modifier rule for the 진행 keys is unchanged.
- `navigation.ts`: `adjacentItem` for the no-item-open and not-in-list cases.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Not reviewed yet.

## Team member's reply

Round 1 (codex2), answered once:

1. Finding 1 (focus guards): the blanket guard is gone. `ownsEveryKey` (an IME
   composition, a column drag, an open menu or dialog) still stops all keys,
   which is rule 4 of "Focus precedence". The rest is per command:
   - Ctrl L works in a text field, because it isn't a text editing key (rule 3).
   - Ctrl Down and Ctrl Up stay with a text field and a textarea, where they
     move the caret (`editsText` on the two commands).
   - A range input (the thumbnail size slider), a checkbox, a radio, and a
     button are not text fields, so all three commands run there, and a focused
     control keeps only its own keys (rule 6). The text field selector excludes
     the non-text input types. Tests: "opens the live item from a text field,
     but leaves Ctrl arrows to the caret", "runs all three from the thumbnail
     slider and from a checkbox", and "runs them from a focused button, which
     keeps only its own keys".
2. Finding 2 (focus lost on item change): `SlideGrid` now remembers whether the
   focus is inside it (`useKeptFocus`: focus in sets it, focus out to an element
   outside clears it, and a pointer press outside clears it), because the
   browser drops the focus to the body when the focused tile is removed, and
   nothing else says where it was. After an item change the grid focuses the new
   selected tile, which is the first one, and sends no output command. Tests:
   "keeps the focus in the grid when another item replaces the focused tile"
   (the fourth morning tile to the three-tile river item), "does not take the
   focus when it was not in the grid", and "does not take the focus back after a
   press outside the grid".
3. Finding 3 (nit): the list test now checks the open item and the event after
   each key, so Down then Up can't pass on the old code. The grid test also
   checks that the event was left alone.

## Verify result

`npm run verify` on commit `31b71d4` (base `main` 89d0b00) passed all five steps
in 158.0 s: `typecheck`, `lint`, `format:check`, `test:coverage`, and `build`.
