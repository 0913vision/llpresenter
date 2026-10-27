# Review request: `screens-19`

- Team member: `screens`
- Branch: `feat/screens/screen-group-ui`
- Review base: `71b0138b` (stacked on screens-18). Exact head: see request line.
- Related brief: `docs/briefs/screens.md`; approved comparison in screens-11.

## What changed and why

The Audience and Stage list headers now provide screen creation and group output
controls. The add menu offers the existing fullscreen, window and capture
methods. Creation uses the approved screens-13 model and shared save queue:
unique name, unassigned monitor, always-on-top off, capture size 1920 x 1080 and
the 200-screen limit. It selects the new screen after saving unless the operator
navigated away or the workspace unmounted. Creating a screen leaves output off.

The group output button sends one existing main-owned batch for the group's
local screens. NDI is excluded. An empty group disables its output control,
shows an empty state and keeps creation available. Read-only settings explain
disabled creation. Keyboard menus preserve screen selection and restore opener
focus.

This follows the sourced Audience/Stage plus and System output-toggle behavior
in [screens-11](screens-11.md). The
[official Screen Configuration article](https://support.renewedvision.com/hc/en-us/articles/360041879173-Screen-Configuration-in-ProPresenter)
was rechecked on October 27. The specified ProPresenter 7.5 guide, printed page
32, documents group toggles for System outputs and separate plus controls.
Supported version 1 output methods and user decisions remain the scope of this
change.

## Changes outside my paths

- `src/renderer/src/ui/ListRow.tsx`, CSS and tests: additive `ListGroup.actions`
  slot that excludes action text from the accessible group name. Preserve main's
  newer selectable-group header and rename behavior, including when actions are
  present; a combined regression covers both selection and action clicks.

## Checks run

- Typecheck, scoped ESLint with zero warnings, formatting and production build
  passed.
- 81 tests in four files passed, including screen creation, limits, read-only
  refusal, delayed-save navigation/unmount, group batches, keyboard focus,
  screen editor persistence and shared ListRow behavior.
- CI pending. The dispatcher checks the exact pushed head.

## Checked in the app

Built and ran the real app with `LLP_TEST_WINDOWS=offscreen`, dev port 5192 and
an isolated screens profile. Both driver scripts passed `node --check` before
every launch. Fixture names and content are invented.

- Start with no screens, inspect both empty groups, then create an audience
  fullscreen screen, audience capture screen and stage window. Each saves with
  always-on-top false, no monitor assignment and output off. Capture size is
  1920 x 1080. The saved row becomes selected.
- Turn both groups on and off through the new controls. Three actual output
  targets appear. Two off/on cycles reuse the same cached target IDs. Menus open
  and close from the keyboard and restore focus to the add button.
- In each of two editable runs, make 20 caption/fullscreen selection round trips
  and leave/reopen the workspace twice. Selection samples hold at 345 elements,
  800 nodes and 517 listeners. Reopens hold at 345 elements, 836 nodes and 517
  listeners after the one-time Show mount. Collected heap moves from 5.90 to
  6.10 MB and 5.91 to 6.14 MB during selection loops.
- A newer-version read-only file disables both add buttons, explains why in a
  tooltip and sends no settings edits. Its revision remains unchanged.
- Both editable runs and the final read-only run exit normally with code 0 and
  no runtime exceptions. An earlier read-only harness teardown hit its exit
  guard; the rerun turns off active outputs and clears hover before closing.

Screenshots:

- [Empty groups](screens-19/first-empty.png)
- [Audience fullscreen add menu](screens-19/first-add-audience-fullscreen.png)
- [Stage window add menu](screens-19/first-add-stage-window.png)
- [New unassigned fullscreen screen](screens-19/first-fullscreen-unassigned.png)
- [Group outputs enabled](screens-19/first-outputs-on.png)
- [Outputs disabled after repeat](screens-19/reopen-outputs-off.png)
- [Read-only reason](screens-19/readonly-add-reason.png)

## Remaining comparison items

Screen deletion/context rename and the configured-versus-active assignment
display remain follow-ups from screens-11. Published monitor ownership stays
with main; this request does not infer or change assignments in the renderer.

## Team member's reply

## Verdicts (recorded by the lead at merge)

- Round 1 (2d8db9e4): reviewer (Codex) Approve. Lead Approve through the lead's
  merge check: the exact-head CI run passed, the branch rebased onto local
  `main` without conflicts, and typecheck passes. Earlier rounds' findings and
  replies are above.
