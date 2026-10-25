Review range: `6f04e76...docs/spec/fallback-window`

# Review request: `spec-20`

- Team member: `spec`
- Branch: `docs/spec/fallback-window`, from `main` (not stacked)
- Base commit (`main`): `6f04e76`
- Spec commit: `b0f485a`
- Review round: 2
- Task: `.llp/task.md`, spec 03 for the fallback window decision

## What changed and why

Spec 03's "When a monitor disconnects during output" now matches the
[2026-10-25 fallback-window decision](../decisions.md#2026-10-25-a-fallback-output-window-goes-behind-the-control-window),
as refined in `dd7212a` for Electron's window-order limits:

- On the disconnect event itself, the output immediately drops always on top and
  goes directly behind the control window, before the 300 ms monitor-list settle
  wait.
- The control window moves directly above the output window without activating
  either window (proposal, pending the user's confirmation on October 26). The
  fallback stays behind the control window even when only one monitor remains.
  The spec no longer promises placement below every other window.
- Its size is 960 x 540 DIP, shrunk to fit when necessary and centered on the
  control monitor's work area.
- The notification's 창 보기 action brings the fallback to the front.
- The 300 ms wait only plans placement. The output stays behind the control
  window during that wait.
- Reconnection returns the output to full screen and restores always on top
  above the control window when that screen's 항상 위 setting is on. When the
  setting is off, always on top stays off.

The spec cites the decision directly. Placement sizing was checked against
`src/main/outputs/placement.ts` and `src/main/displays/rect.ts`. This request
updates the specified behavior; it does not claim to fix or verify runtime
window placement.

The decision records the Electron-only approach as the lead's choice, pending
the user's confirmation on the morning of October 26.

## Round 2 response

1. Restored the reconnect transition's always-on-top behavior according to the
   screen's setting, matching the earlier output-window rules in spec 03.
2. Marked the control-window-above mechanism as a proposal until the user's
   October 26 confirmation.
3. Removed implementation identifiers from the disconnect section. It describes
   window order, activation, the 300 ms wait, size, and work-area centering.
   Implementation references remain in the decision record.

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

The branch was rebased onto main at `6f04e76` before the final push. A fully
green CI run of the submitted HEAD is required. Its URL and result are recorded
in the request report, avoiding another unverified commit just to record CI
metadata.

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude, trial-97): Request changes: the reconnect paragraph did not
  restore always on top; nits: mark the control-window-above mechanism as a
  proposal until the user confirms it, and keep code identifiers out of the
  spec.
- Round 2 (53692f3): reviewer (Claude, trial-97) Approve. Lead Approve. Written
  by the Codex session that took over spec's work. Merged by the lead without
  conflicts.
