Review range: `10fadab4...feat/spec/service-tree`

# Review request: `spec-48`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/service-tree`
- Base commit: `10fadab4`
- Review round: 1
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
  and the check-all box, and a `CheckList` of `CheckRow`s (headers in the
  `group` variant, their items indented under them). With no rows it shows no
  check-all box, and an optional line that says why.

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
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep/services src/shared/schema/contentDocuments.test.ts src/main/store` | Pass, 388 tests        |
| `npx --no-install eslint --max-warnings 0 src/main/store src/shared/schema src/renderer/src/prep/services`                                | Pass                   |
| `npx --no-install prettier --check src/main/store src/shared/schema src/renderer/src/prep/services`                                       | Pass                   |
| GitHub CI (`npm run verify`)                                                                                                              | In the request message |

Tests: every row kind's label, icon, and detail, the header each item sits
under, and a missing song; the item count; a full selection, the mixed header
and check-all states, checking a header with items and an empty header, and the
checked ids in order; and the rendered box with its count, its rows, the header
and check-all clicks, and the empty state.

No Electron process, visible window, soak, or memory measurement was started.
