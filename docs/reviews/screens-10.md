# Review request: `screens-10`

- Team member: `screens`
- Branch: `fix/screens/display-layout-sizing`
- Base and exact head: see request line.
- Bug: M3-C3-8, the user's live check of 화면 설정 > 배치.
- Feature-freeze scope: bug fix only. New O2 units are parked.

## What changed and why

With a 3440 x 1440 primary monitor and a 1920 x 1080 monitor at (3440, 222), the
output preview sized itself from the full center-column width. Its intrinsic
height consumed the column, shrinking the layout panel to zero height. In the
real app both monitor boxes became overlapping 2 x 2 px borders.

The layout and output-preview panels now share available height. The preview
fits a 16:9 picture into its measured remaining space, keeping the mode switch
and caption at their normal heights. It no longer determines the height of the
column from its width.

The arrangement still uses one uniform scale, preserving monitor aspect ratios,
adjacency and offsets. Its minimum scale gives every monitor at least six row
units of width and four of height (180 x 120 px with the current tokens). A
smaller viewport scrolls the arrangement instead of shrinking labels below that
size. Margins center a fitting arrangement while keeping overflowing content
reachable from its origin.

Monitor boxes and separate-window cards are keyboard-accessible buttons.
Clicking an occupied monitor selects a screen main publishes on that monitor; an
empty monitor can be highlighted without assigning a screen or sending a
command. Changing the screen selection or monitor publication replaces that
local highlight. Clicking a separate card selects its screen in the shared list
and properties. Read-only documents still allow selection. Drag assignment
retains the control-monitor and read-only guards.

Fullscreen screens without a published placement now appear beside separate
windows instead of disappearing from the layout. Cards distinguish capture
windows, regular windows, missing assignments and a pending connection. The
panel names the no-monitor and no-screen states. Assignment display continues to
use main's published `screenIds`; the window does not resolve monitor ownership.

## Changed files

- `DisplayLayout.tsx`, CSS and tests: scale floor, scrollable layout, buttons,
  current selection and empty states.
- `layoutBoxes.ts` and tests: selectable screen ids and unassigned targets.
- `testing/monitorArrangement.ts`: the exact two-monitor geometry from the
  check.
- `OutputPreview.tsx` and CSS: fit the picture inside available panel space.
- `docs/reviews/screens-10/`: before and after real-app screenshots.

### Changes outside my paths

- `src/renderer/src/shell/Workspace.tsx`: remove content-based sizing only from
  the screens workspace's output-preview panel, so it shares height with 배치.
  ScreenEditor and selection public APIs are unchanged. The lead was notified.

## Checks run

The request line records post-rebase typecheck, scoped tests, ESLint,
formatting, build and exact-head CI. The geometry fixture checks both aspect
ratios and the 222 px offset. Component tests cover both editable and read-only
selection, changed published ownership, empty states and existing drag guards.

## Checked in the app

Pending the final post-rebase offscreen runs. The before screenshot already
reproduces the user's exact monitor arrangement and the overlapping 2 x 2 boxes.
Final measurements, repeat counts and screenshots are recorded before requesting
review.

![Before at 3440 x 1440](screens-10/before-3440.png)

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
