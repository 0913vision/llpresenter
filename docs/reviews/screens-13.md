# Review request: `screens-13`

- Team member: `screens`
- Branch: `feat/screens/add-screen`
- Stacked base: `e1604a49`, screens-12. Exact head and CI: see request line.
- Scope: screen-creation persistence foundation for the approved screens-11
  ProPresenter comparison. O2 remains parked.

## What changed and why

The current Screen settings list cannot add a screen. This small request adds
the creation model and serialized save API before the visible creation menu and
output controls. The comparison and sources are recorded in
[screens-11](screens-11.md), Add screens row; ProPresenter 7.5 adds screens
within Audience or Stage. The follow-up UI will use our existing version 1
methods.

`addScreen` creates an unassigned Audience or Stage screen with explicit
`alwaysOnTop: false`, as the user decided. Capture screens start at 1920x1080.
It generates a unique group-specific name against the newest list, including
whitespace-padded names, preserves existing objects and unknown fields, and
enforces main's existing 200-screen limit. Duplicate IDs are rejected.

The additive `ScreenEditor.add` and hook method use the existing shared settings
editor and close-write gate. A held earlier save cannot make a queued creation
fall outside the close flush. The created screen does not send an output-on
command. Existing change/assignment methods and selection APIs are unchanged.

## Changed files

- `src/renderer/src/screens/addScreen.ts` and tests: bounded creation model and
  explicit defaults.
- `src/renderer/src/screens/screenEditor.ts` and tests: queued creation,
  close-flush and read-only coverage.
- `src/renderer/src/screens/useScreenEditor.ts`: additive creation action.

### Changes outside my paths

- `src/shared/schema/ids.ts` and tests: additive nonthrowing `parseScreenId`,
  validating generated IDs with the existing lowercase UUID-v4 schema. Includes
  valid, malformed, wrong-version, uppercase and oversized inputs.

## Checks run

Typecheck, scoped ESLint, formatting and 62 tests across five creation, ID,
editor, properties and workspace files pass. The tests include rapid creation
without a settings push, a creation queued behind a held property save with a
close flush, read-only refusal and the screen cap. Exact-head CI is recorded in
the request line.

## Checked in the app

This request adds no mounted creation control and changes no visible flow. The
new API is exercised through delayed-save, close-handshake, schema and read-only
tests. The visible follow-up will exercise creation and output control in the
real offscreen app and include screenshots before its request.

## Team member's reply
