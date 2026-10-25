Review range: `bc03912...docs/spec/fallback-window`

# Review request: `spec-20`

- Team member: `spec`
- Branch: `docs/spec/fallback-window`, from `main` (not stacked)
- Base commit (`main`): `bc03912`
- Spec commit: `c26f2a9`
- Task: `.llp/task.md`, spec 03 for the fallback window decision

## What changed and why

Spec 03's "When a monitor disconnects during output" now matches the
[2026-10-25 fallback-window decision](../decisions.md#2026-10-25-a-fallback-output-window-goes-behind-the-control-window),
recorded in `1acb9b8` and refined in `bc03912` after the real-monitor unplug
check:

- On the disconnect event itself, the output immediately drops always on top and
  goes behind the control window without taking focus, before the 300 ms
  monitor-list settle wait.
- Its size follows `placement.ts`'s `OUTPUT_WINDOW_SIZE`, currently 960 x 540
  DIP, shrunk to fit when necessary and centered on the control monitor's work
  area.
- The notification's 창 보기 action brings the fallback in front of the control
  window.
- The 300 ms `DISPLAY_SETTLE_MS` wait only plans placement. The output stays
  behind the controls during that wait; the earlier expected-flash wording was
  removed to match the refined decision.

The spec cites the decision directly. Placement sizing was checked against
`src/main/outputs/placement.ts` and `src/main/displays/rect.ts`. This request
updates the specified behavior; it does not claim to fix or verify runtime
window placement.

## Changed files

- `docs/spec/03-output.md`, limited to the disconnect section and its source.
- `docs/reviews/spec-20.md`.

## Checks run

| Check                                            | Result                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Decision-to-spec comparison                      | Pass: all requested behaviors and citation                                   |
| Placement size and work-area centering reference | Pass                                                                         |
| Changed-file Prettier                            | Pass                                                                         |
| `git diff --check`                               | Pass                                                                         |
| Local unit tests and full verify                 | Not run: documents only; full verification belongs to CI                     |
| GitHub branch CI                                 | Exact submitted HEAD's run URL and result are included in the request report |

The branch was rebased onto main at `bc03912` before the final push. A fully
green CI run of the submitted HEAD is required. Its URL and result are recorded
in the request report, avoiding another unverified commit just to record CI
metadata.
