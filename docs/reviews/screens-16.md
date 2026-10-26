# Review request: `screens-16`

- Team member: `screens`
- Branch: `feat/screens/look-editor`
- Base and exact head: see request line.
- Scope: resumed M3-O2, the selected Look's header, per-screen layer cards and
  previews. Shared lyric-style authoring follows in the next small unit.

## What changed and why

Selecting a Look now opens its editor across the center and right workspace
columns. Each configured screen gets a card with the applicable layer checklist,
target and preview. Audience cards select shared lyric styles; stage cards
select layouts; caption cards choose green, black or media backgrounds. Style
and layout assignments can also return to their default values.

The header shows the selected Look's name and current mark, accepts validated
name edits and duplicates through the shared save queue. A copy that finishes
after navigation cannot take selection away. Read-only files disable every edit
with the existing reason tooltip. Selecting or editing a noncurrent Look never
activates it. Editing the current Look continues using the existing output
settings feed.

Previews reuse the output renderer under the selected Look and mount only while
visible. Leaving releases their observers, renderers and live subscriptions. The
body uses thin design-system scrollbars. Output warnings reserve space above the
last column in both the normal screen layout and this two-column view.

Stage selection keeps the interim retained screen view until output's O3 lands.
The selection discriminator and ScreenEditor APIs are unchanged.

## Changes outside my paths

- `src/renderer/src/shell/Workspace.tsx` and CSS: route Look selections to the
  two-column editor and preserve warning clearance. The existing screen/stage
  route remains available for output's O3.

## Checks run

Pending final post-rebase checks. Tests cover layer isolation, style/layout
assignment and removal, backgrounds, read-only refusal, focused name commits,
duplicate/navigation races and workspace routing.

## Checked in the app

Pending final rebased build, repeated offscreen/CDP checks and screenshots.

## Remaining M3-O2 work

The shared lyric-style section below the cards: preset selection, preview,
properties and guarded style lifecycle. This request provides card assignment to
existing styles; it does not claim that the full O2 scope is finished.

## Team member's reply
