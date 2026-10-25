Review range: `938e466...feat/spec/service-item-start`

# Review request: `spec-28`

- Team member: `spec`
- Branch: `feat/spec/service-item-start`
- Base: spec-27 at `938e466`, pending its merge before submission
- Review round: 1
- Task: `.llp/task.md`, M3-S1a item start and service progress
- Ownership exception: renderer state and show paths for S1a

## What changed and why

Sending the first slide of another service item now sends `item.start` before
the slide command. The asynchronous song-background path first validates the
refreshed tile and all existing request, command-version, and service guards;
only then can it send `item.start`, background, and lyrics, in that order. A
stale or removed tile sends none of them.

The last slide item's identity survives a lyrics clear. Same-item navigation and
re-triggering after clear do not start it again. Returning after another item
starts it again exactly once for that transition. Selecting a row sends no start
or output. The existing main-owned action runs the start macro.

Only known service rows with a validated ServiceItemId can send `item.start`.
Quick slides without service rows do not start service macros. Older untyped
projection fixtures can still output lyrics without sending an invalid start
command. There is no cast around the shared action's branded id contract.

## Done and LIVE states

The renderer remembers started items for its window lifetime. The current item
from an accepted live feed also seeds that history, so opening the control view
on existing output does not restart its macro. The history holds at most 10,000
distinct items; the oldest retained id is dropped when a new id exceeds that
cap. Repeated starts keep the same set reference and do not redraw every row.

The design system's done state applies only to remembered items above the
current item in the current service order. Unplayed items stay undimmed even
when skipped. Reordering recomputes position without changing output. Lyrics
clear removes LIVE while keeping the last current item and its progress. LIVE
continues to follow the actual live slide rather than the open selection.

## Checks run

| Check                                                        | Result                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Item-start, navigation, background, and existing panel tests | Pass: 81 tests in four files                                       |
| Renderer TypeScript check                                    | Pass                                                               |
| Changed-file ESLint and Prettier                             | Pass                                                               |
| `git diff --check`                                           | Pass                                                               |
| Local full verify                                            | Not run, per the lead's rule                                       |
| GitHub branch CI                                             | Required after rebasing onto main; URL and result go in the report |

The fake command sink checks start-before-output ordering, same-item and clear
deduplication, returning to an item, quick slides, untyped ids, successful
background refresh, removal during refresh, superseded refresh, initial live
state, bounded history, and done states after skips, clear, and reorder.
Existing navigation and background regressions remain green. No Electron
process, visible window, soak, or memory measurement was started.

## Changed files

- `state/show.ts`: start dispatch after validation and before output commands.
- `state/live.ts`: bounded started-item history and initial live-feed seeding.
- `show/ServiceOrderList.tsx`: done state using history and current row order.
- `state/itemStart.test.tsx`: new behavior and race coverage.
- `docs/reviews/spec-28.md`.

The slide header and service picker remain assigned S1a follow-ups. Picker
wiring still waits for the lead's data-33 merge announcement. S1b is excluded.
