# Review request: `screens-18`

- Team member: `screens`
- Branch: `feat/screens/lyric-style-lifecycle`
- Review base: `8cbd2477` (stacked on screens-17). Exact head: see request line.
- Related brief: `docs/briefs/screens.md`, M3-O2.

## What changed and why

The lyric-style segments now have a pointer and keyboard context menu for new,
rename and delete. A plus button also works when the list is empty. New presets
copy the chosen preset, preserving unknown fields, with an unused `새 스타일`
name. An empty list starts with the bundled default. New lists are capped at
1,000 presets without trimming imported data.

Renaming hands focus off after menu cleanup, validates names and commits on
Enter or blur. Escape cancels. A focused valid name joins the existing
close/save path. Late additions cannot take selection away from subsequent
navigation.

Every Look participates in the deletion guard, including inactive Looks. The
menu explains the disabled action in its tooltip. The serialized queue checks
references again when deletion executes, so an intervening assignment cannot
leave a dangling reference. A domain refusal leaves the document unchanged and
does not make an otherwise completed close flush fail. Read-only files disable
all lifecycle edits with the existing reason tooltip.

## Changes outside my paths

- `src/shared/schema/ids.ts` and its tests: additive nonthrowing lyric-style
  UUID parser. Stored IDs and schemas are unchanged.

## Checks run

- Typecheck, scoped ESLint with zero warnings, formatting and production build
  passed.
- 87 tests in 13 files passed, including focused keyboard-menu rename, invalid
  names, delayed creation/navigation, read-only actions, reference guards and a
  held-save/queued-assignment/delete/close regression.
- CI pending. The dispatcher checks the exact pushed head.

## Checked in the app

The production build ran twice with `LLP_TEST_WINDOWS=offscreen`, dev port 5192
and an isolated screens profile. Both driver scripts passed `node --check`
before each Electron launch. Fixtures and sample text are invented.

- Start from a focused preset segment, invoke the keyboard context menu and
  rename after focus reaches the input. Escape cancels without changing the
  settings revision. A style used in inactive and current Looks has deletion
  disabled.
- Create from a styled preset and verify that size 132 and an unknown fixture
  field survive. Delete unused presets, detach fixture references, delete the
  final preset, inspect the empty state and create a default size-84 preset.
- In each run, make 20 preset-selection round trips while opening and closing
  the context menu each time. Elements remain 584, nodes 1,947 and
  listeners 551. Collected heap changes from 5.97 to 6.17 MB and 5.99 to 6.20
  MB.
- Leave/reopen the workspace twice per run. After the one-time Show mount, both
  samples hold at 584 elements, 2,241 nodes and 599 listeners.
- Leave a valid style name focused without Enter or blur, close the real control
  window and verify the saved name on restart before fixture reset. Both
  editable runs exit normally with code 0 and no runtime exceptions.
- In a newer-version read-only file, the plus button and all context-menu edits
  are disabled. Attempts leave the settings revision unchanged. This app run
  also exits 0 with no runtime exceptions.

Screenshots:

- [Used preset deletion guard](screens-18/first-used-style-guard.png)
- [Created preset](screens-18/first-new-style.png)
- [Empty styles with creation available](screens-18/first-empty-styles.png)
- [Focused rename before closing](screens-18/first-focused-rename-close.png)
- [Repeated app run](screens-18/reopen-new-style.png)
- [Read-only lifecycle](screens-18/readonly-lifecycle.png)

## Decisions I made

New style copies the targeted preset's properties. With no preset it uses the
bundled defaults. The plus button provides creation when there is no segment to
right-click. Neither action changes Look assignments or activates a Look.

## Where to look

- Menu cleanup occurs before the rename field mounts.
- Queued assignments are included in the shared-style deletion guard.
- Refused deletion reports its domain reason without registering a failed write.
- Preset selection and renderer behavior stay as introduced in screens-17.

## Team member's reply
