# Review request: `screens-16`

- Team member: `screens`
- Branch: `feat/screens/look-editor`
- Review base: `4945d6fe`. Exact head: see request line.
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

Tests cover layer isolation, style/layout assignment and removal, backgrounds,
read-only refusal, focused name commits, duplicate/navigation races and
workspace routing.

- Post-rebase typecheck, scoped ESLint, Prettier and production build passed.
- 85 tests in 9 files passed with one worker. The first parallel run hit eight
  worker-start timeouts under local load; the serial rerun completed all files.
- CI pending. The dispatcher checks the exact pushed head.

## Checked in the app

The production build runs through CDP with `LLP_TEST_WINDOWS=offscreen`, dev
port 5192 and an isolated screens profile. All driver scripts pass
`node --check` before Electron starts. Fixtures use the invented text
`LOOKCHECK`.

- Select a Look, duplicate it, and change audience layers, shared style,
  stage-layout assignment and caption background. Selecting the copy leaves the
  live Look unchanged. Hiding lyrics in the copy changes its preview while the
  native current output stays visible. Editing the current Look hides and
  restores the native output immediately.
- Switch between Looks 20 times and leave/reopen the workspace twice per run.
  Compare DOM, listeners and heap after collection; repeat the full run after
  restarting Electron.
- At 1024 x 720, cards wrap to two columns and scroll without horizontal
  overflow.
- Leave a valid Look name focused without Enter or blur, close the real control
  window, and verify that the next launch loads the saved name.
- Open a newer-version read-only settings file. Name, duplicate and card
  controls are disabled; attempted interactions leave the settings revision
  unchanged.

In the repeated final run, 20 selection round trips held at 470 elements, 1,504
nodes and 519 listeners. Collected heap moved from 5.94 MB to 6.06 MB. The two
workspace reopens both held at 470 elements, 1,537 nodes and 519 listeners after
the one-time Show workspace mount. No runtime exceptions occurred. The first
cold run exceeded the driver's 10-second exit guard after saving; the next two
editable runs and the read-only run exited normally with code 0.

Screenshots:

- [Selected Look cards](screens-16/first-selected-look-cards.png)
- [Selected copy and unchanged native output](screens-16/first-live-unchanged-by-selected-look.png)
- [Current Look lyric layer disabled](screens-16/first-live-current-layer-off.png)
- [Narrow workspace](screens-16/first-narrow-cards.png)
- [Focused name before close](screens-16/first-focused-name-before-close.png)
- [Reopened editor](screens-16/reopen-selected-look-cards.png)
- [Read-only editor](screens-16/readonly-cards.png)

## Remaining M3-O2 work

The shared lyric-style section below the cards: preset selection, preview,
properties and guarded style lifecycle. This request provides card assignment to
existing styles; it does not claim that the full O2 scope is finished.

## Team member's reply
