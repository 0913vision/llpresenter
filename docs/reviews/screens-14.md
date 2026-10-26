# Review request: `screens-14`

- Team member: `screens`
- Branch: `fix/screens/keep-screen-panels`
- Base, exact head and CI: see request line.
- Scope: M3-UX-03/04 interim screen-view retention, M3-UX-06 inset and M3-UX-09
  delete wording from `docs/qa/m3-ux-pass.md` on `docs/qa/m3-ux`.

## What changed and why

Selecting a Look or stage-layout row used to make the screen preview and
properties empty. Until the corresponding editors replace these panels, they now
keep the previously viewed screen. The selected row still belongs to the Look or
stage-layout list; screen rows do not gain a second selection. The retained
screen survives leaving and reopening Screen settings. If it is removed, the
existing Audience-first fallback chooses an available screen.

`selection.kind`, `select` and `selectedScreenIn` keep their existing contracts.
The store adds only `lastScreenId` and the `useScreenView` hook for screen
panels. Output's O3 can continue routing on the existing `selection.kind`
unchanged. No settings document, IPC contract or output command behavior
changes.

The preview renderer stays mounted when another list takes selection. Its
test-pattern mode resets and sends the existing hide command. A property edit
that pins the same visible screen does not reset the pattern, so correction
controls remain usable during a pattern check.

Screen properties now use the shared `panel-inset` on both edges.
Referenced-Look delete confirmations now ask a complete polite Korean question,
matching the design-system writing rule. Macro names and cancellation behavior
are preserved.

## Changes outside my paths

None. Shared screen-view files touched: `selection.ts`, `DisplayLayout.tsx`,
`OutputPreview.tsx`, `ScreenProperties.tsx` and its CSS. O3 is output-owned;
this request leaves its selection discriminator intact.

## Checks run

Pending final rebase checks. Regression tests cover both row kinds, remounts,
one selected list, pattern cleanup without recreating the renderer, and
retaining the pattern while a property edit pins the same screen.

## Checked in the app

Pending final build, repeated offscreen flow, geometry checks and screenshots.

## Team member's reply
