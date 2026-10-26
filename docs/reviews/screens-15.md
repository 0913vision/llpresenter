# Review request: `screens-9`

- Team member: `screens`
- Branch: `feat/screens/look-card-model`
- Base and exact head: see request line.
- Related brief: `docs/briefs/screens.md`, M3-O2 card persistence and preview.

## What changed and why

Adds the persistence and preview path for editing a selected Look's screen
cards. The next unit mounts the cards and their controls in the center
workspace.

Card edits change one layer switch, lyric style, stage layout or background
while preserving other cards, fields and file data. A screen without a saved
card draws every layer in the existing renderer. Its first edit starts with
those effective switches, avoiding an unrelated disappearance of every other
layer. Existing cards keep the rule that absent switches are hidden. Missing
Looks and removed lyric-style references leave the file unchanged.

Card edits enter the same settings session as lifecycle operations. A held
rename followed by two card changes uses successive revisions, retains every
change and keeps the close flush pending until the queued saves finish.

`LookPreview` reuses `OutputRenderer` in preview mode. It follows live content
but resolves the selected Look instead of the live Look. Output test patterns
and per-output stage overrides do not override the Look being edited. A stage
card uses its saved layout and the live stage message and timer selection.
Picture correction follows the configured screen. Props redraw the existing
renderer; live changes draw without React rerenders. Unmount releases the live
subscriber and renderer. The preview sends no output commands and uses main's
timer clock.

## Changed files

- `looks/lookCardEdits.ts` and tests: pure card changes and missing-card
  fallback.
- `lookListEditor.ts`, `useLookListEditor.ts`: share the existing writer with
  card changes; the public screen editor and selection APIs are unchanged.
- `lookListEditor.test.ts`: a held list save followed by queued card saves and
  close flush.
- `lookPreviewFrame.ts` and tests: selected-Look frame resolution, safe missing
  references, stage selection and picture correction.
- `LookPreview.tsx`, CSS and tests: output renderer adapter, drawing and
  cleanup.
- `docs/reviews/screens-9.md`: this request.
- Changes outside my paths: none. No output renderer or shared contract changes.

## Checks run

The request line records post-rebase scoped checks, formatting and exact-head
CI. No Electron or full local verify was run.

## Remaining M3-O2 work

Mount the center Look editor and per-screen cards. Then add shared lyric-style
lifecycle and controls. M3-O3 remains with output.

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
