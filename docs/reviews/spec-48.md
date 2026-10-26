Review range: `10fadab4...feat/spec/service-tree`

# Review request: `spec-48`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/service-tree`
- Base commit: `10fadab4`
- Review round: 3
- Task: M3-P4, part 1 of 3 for 새 예배 (P4a): the item counts in the lists and
  the 예배 순서 tree the service dialogs check items in
- Code owners: data for `src/shared/` and `src/main/store/`; prep for
  `src/renderer/src/prep/services/` (no prep member; lead exception for P4)

## What changed and why

Spec 05 "New service" and "Importing from another service" both show a list of
sources on the left, with "항목 9개" under each 틀 and past service, and a "예배
순서" box on the right with a check-all box, the count, and a tree of headers
and items with check boxes. P4a was about 1,660 lines, so I split it into three
requests of about 600 lines, stacked:

1. This one: the counts and the tree.
2. `feat/spec/service-sources`: the source lists, the date and time choices, and
   the left list.
3. `feat/spec/new-service`: the 새 예배 dialog, its create flow, and its entry
   in the service picker.

This request:

- **Item counts.** `ServiceEntry` and `TemplateEntry` get an optional
  `itemCount` (a non-negative integer, at most `ENTRY_ITEM_COUNT_MAX`, 10,000).
  Main counts the items that aren't headers when it builds the lists, from the
  documents it already holds in memory, and clamps to the cap. The lead approved
  this addition (P4 Q1).
- **Tree.** `serviceTree.ts` turns an order into rows: a header shows its text;
  a song shows its title (or 곡을 찾을 수 없음) with its 구성 as the detail
  (기본 when none is chosen, as spec 05 "Importing" asks for the 구성 name); a
  slot shows its title with 빈 자리; a passage shows its reference; media,
  notices, and unknown items show 미디어, 공지, and 알 수 없는 항목. Each item
  knows the header before it. Icons match the 예배 순서 list.
- **Selection.** A full selection holds every item and every header with no
  items under it. A header's box shows its items' state (mixed when some are
  checked), and checking it checks or unchecks all of them, as spec 05 asks. An
  empty header is checked on its own. `selectedIds` gives the checked ids in
  order; main's `service.importItems` adds the headers of picked items itself.
- **Box.** `SourceTree` is the "예배 순서" box: ui's `DialogBox` with the count
  and the check-all box, and the items as a tree with check states (below). With
  no rows it shows no check-all box and no tree, and an optional line that says
  why.

## Round 2 response

1. **Tree semantics.** The rows are now a `role="tree"` (named 예배 순서 항목,
   `aria-multiselectable`) of `role="treeitem"` rows, as the Checkbox README
   asks, instead of a `CheckList`. Each row has `aria-checked` (`mixed` for a
   header with some items checked), `aria-level` (1 for headers and items with
   no header, 2 for items under a header), and `aria-posinset` and
   `aria-setsize` within its level; a song's 구성 or a slot's 빈 자리 is its
   description. Focus moves between the rows themselves: Tab enters the tree
   once, the up and down arrows, Home, and End move, Left goes from an item to
   its header, and Space toggles. The box in each row is ui's `Checkbox`, hidden
   from assistive technology and out of the tab order, so it only draws the
   state; a click anywhere on the row toggles it, as before. The row look
   follows the README's list and group header rows, in this folder's CSS module,
   since `CheckRow` can't be a tree row. Tests assert the tree, its name, the
   levels and positions, the checked and mixed states, the description, no
   checkbox inside the tree, and the keyboard.
2. **Enter.** Enter in the tree stops there, and a click on a row's box leaves
   focus on the row, never on the box, so useModal never sees a focused checkbox
   there. A test puts the tree inside ui's `Dialog`, clicks a row's box, and
   presses Enter on two rows without pressing 만들기; Enter on the check-all box
   above still presses it. I checked that the test fails with both guards
   removed.
3. **TSDoc.** The service list's comment is back above `serviceEntries`; the
   private `itemCount` keeps only its NOTE.

## Round 3 response

1. **Focused row.** A key acts on the row it was pressed on, taken from the
   event's target, and a row that takes focus any way (a click, Tab, or a right
   click) becomes the tree's tab stop. A test clicks one row, focuses another
   without a click, and presses Space and the up arrow there; it fails with both
   changes removed.
2. **Positions.** `serviceTree.ts` reads each rows array once into a shape kept
   in a `WeakMap`: each header's items, each row's level, position, and size,
   and the full selection. `treePosition`, `rowState`, `allState`, `toggleRow`,
   and `checkAll` look up the shape, so a render and a key press are linear in
   the rows. The hooks keep the rows array with `useMemo`, so the shape is built
   once per source. A test checks the positions and that a second lookup returns
   the same object.

## Decisions I made (for the lead to confirm)

1. A slot row shows 빈 자리 as its detail text instead of the dashed box spec 05
   draws. `CheckRow` has no slot look, and `ListSlotBox` is a `ListRow` part. If
   ui adds a slot variant to `CheckRow`, the tree can use it.
2. An empty header counts as one checkable row, so a header such as 광고 with no
   items under it comes along when it is checked.

## Changes outside my paths

- `src/shared/schema/contentDocuments.ts` (data): the optional `itemCount` on
  both entries, with `ENTRY_ITEM_COUNT_MAX`, and valid and invalid tests (0, 9,
  the cap; -1, 1.5, the cap plus one, a string).
- `src/main/store/contentLists.ts` (data): the counts, with a test that a
  service and a 틀 report 3 and 1.

## Validation

| Command or test                                                                                                                           | Result                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                                                                                       | Pass                   |
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep/services src/shared/schema/contentDocuments.test.ts src/main/store` | Pass, 392 tests        |
| `npx --no-install eslint --max-warnings 0 src/main/store src/shared/schema src/renderer/src/prep/services`                                | Pass                   |
| `npx --no-install prettier --check src/main/store src/shared/schema src/renderer/src/prep/services`                                       | Pass                   |
| GitHub CI (`npm run verify`)                                                                                                              | In the request message |

Tests: every row kind's label, icon, and detail, the header each item sits
under, and a missing song; the item count; a full selection, the mixed header
and check-all states, checking a header with items and an empty header, and the
checked ids in order; and the rendered tree: its name, levels, positions,
checked and mixed states, description, clicks, keyboard moves and Space, Enter
inside a dialog, and the empty state.

No Electron process, visible window, soak, or memory measurement was started.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex4): Request changes: a flat checkbox group without tree
  semantics; Enter in the tree triggered the dialog's primary action.
- Round 2 (Codex, codex4): Request changes: keys acted on a cached row instead
  of the focused one, and position work was quadratic.
- Round 3 (010c0910): reviewer (Codex, codex3, codex4 being busy) Approve, no
  findings. Lead Approve. The additive `itemCount` on the list entries is
  data-side (lead approval, Q1). Rebased by the lead onto local `main` without
  conflicts; typecheck passes.
