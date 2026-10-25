# Review request: `output-21`

- Team member: `output`
- Branch: `fix/output/fallback-window`
- Base: `5234318452661ec630c824fd8a67f4268b00ce7f`
- Verified code head: `43531dec4ff59de1a1b6142623b57c89426bd1f6`
- Range: `5234318...fix/output/fallback-window`
- Task: the M2 fallback-window fix, before M3-O10.
- Code CI:
  [40203847027](https://github.com/0913vision/llpresenter/actions/runs/40203847027),
  success. The final document head is checked too before the request.

## What changed and why

The unplug record showed the fallback at x 2480, y 492 instead of the planned
center. `showWindowed` previously set the planned bounds immediately after
requesting fullscreen exit. Windows could then restore the old normal bounds
from the disconnected monitor, overwriting that placement. The output now
applies the planned bounds on the next event-loop turn after
`leave-full-screen`, with a 500 ms exit deadline when the event is missing.

Per the lead's decision `dd7212a`, the output first drops always on top and then
calls `control.moveAbove(output.getMediaSourceId())`. This happens synchronously
on the affected monitor's `display-removed` event, before the 300 ms settle
timer, and again after windowed placement. Neither window is focused or
activated. The fallback keeps drawing and retains its page and video; it is not
hidden or reloaded. No native API or dependency is added.

The existing settled monitor list still decides the placement. Other output
switch changes during the wait cannot restore the missing monitor's always on
top prematurely. A reconnect restores the screen's configured always-on-top
value. Even a disconnect/reconnect inside one settle interval reapplies it when
the final monitor list equals the original list.

Only the latest placement is retained while fullscreen exits. Hiding, switching
back to fullscreen, closing, or destroying cancels an obsolete fallback action.
An unplaced centered rectangle survives an off/on cycle so the first placement
still receives its bounds. Fullscreen, move and resize listeners, timers, and
pending actions are released on destroy or native close. Deferred native-event
failures are logged; a failed demotion does not prevent another output from
being demoted.

## Changed files

- `src/main/displays/`: typed source changes, synchronous removal subscription,
  settled-list recovery, fake source, and source/registry tests.
- `src/main/outputs/`: placement and ordering adapter, control-window wiring,
  affected-window demotion, fake handle/feed, and regression tests.
- Source and tests: 15 files, 1015 insertions and 52 deletions. Round 2 is the
  focused delta `656d073..43531de`: 6 files, 511 insertions and 46 deletions,
  including this reply and the native CI fixture.
- No shared/preload contracts or other team's files changed.

## Checks run

| Check                                                | Result                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| Focused display/output tests                         | 6 files, 85/85 passed, 0.960 s; native CI test skipped            |
| New bounds and ordering cases against old adapter    | Both failed as expected                                           |
| Immediate-removal case against old manager           | Failed as expected, 0 demotions instead of 1; restored in finally |
| `npm run typecheck`                                  | Passed                                                            |
| Targeted ESLint on changed TypeScript files          | Passed                                                            |
| `npm run format`, `npm run format:check`, diff check | Passed                                                            |
| Rebase onto main                                     | Completed without conflicts                                       |
| Own branch push                                      | Passed                                                            |
| GitHub code CI                                       | Success, run 40203847027                                          |
| Local full verify                                    | Not run, per the lead's rule                                      |

All local tests use fake Electron windows and timers. No real Electron process
or visible window was started. There were no display-layout test failures to
classify. The overnight DP-primary removal and BenQ-only environment is noted;
there were no soak or memory measurements. CI status requests are spaced at
least five minutes apart.

## Decisions and review focus

- The control-relative ordering is the lead's explicit choice, replacing the
  earlier request to put the output below every window. Hiding and native calls
  remain rejected.
- Check the call order in the adapter tests and the pre-settle integration test.
  Both unrelated outputs and another output whose demotion fails are covered.
- Check fullscreen-exit cancellation, subscription disposal, and both early
  reconnect and fullscreen/fallback/fullscreen always-on-top restoration.
- Native fullscreen exit is measured on the GitHub Windows runner. The actual
  HDMI unplug check is deferred until the user is awake, as the lead requested.
- Full green GitHub CI is required. There is no GPU exception.

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude, trial-97): Request changes: the placement relied on
  `leave-full-screen` arriving after Windows restores the pre-full-screen bounds
  (unproven), and a missing leave event would defer the windowed placement and
  the reconnect forever.
- Round 2 (fef8651): reviewer (Claude, trial-97) Approve. Nit, only if the
  user's HDMI recheck still finds the window at the right edge: keep watching
  `move` and `resize` until about the display settle plus a margin (about 1 s)
  instead of stopping at `BOUNDS_RECHECK_MS` (100 ms). Lead Approve. Written by
  the Codex session that took over output's work. Rebased by the lead onto local
  `main` without conflicts.

## Team member's reply

1. The timing assumption is removed. Even a synchronous `leave-full-screen`
   queues placement to the next event-loop turn. After placing, a move or resize
   queues a bounds read; a 100 ms check also covers a restore without either
   event. A mismatch reapplies the target once, repeats the control-relative
   ordering, and disarms all checks. The fake covers both a restore inside
   `setFullScreen(false)` after its synchronous leave event and a later restore.
   It also proves that later operator moves are left alone. A GitHub
   Windows-only real Electron fixture records `getBounds()` during the leave
   event, after `setFullScreen(false)` returns, on the next turn, and after
   settling. It checks the shared production placement helper and fullscreen
   reconnect. Measurements from its CI coverage artifact are recorded below.
   Both the test and child refuse local execution.
2. `FULLSCREEN_EXIT_DEADLINE_MS` bounds the leave-event wait at 500 ms. The
   deadline clears the waiting state and runs the latest pending placement,
   including a fullscreen reconnect. Fake tests omit the leave event and prove
   that both the windowed request and a later fullscreen request complete by
   that deadline. Cancellation, native close, and dispose release the queued
   action, the checks and all three native listeners.

Round 2 local checks: 85/85 focused tests passed in 0.960 s, the one native CI
test skipped, typecheck and targeted lint passed, and the native fixture's
bundle and syntax check passed without launching Electron. Six new cases all
failed against the round 1 adapter, which was restored in finally. No local full
verify, visible window, soak, or memory measurement ran.

## Round 2 native Windows measurements

[CI run 40203847027](https://github.com/0913vision/llpresenter/actions/runs/40203847027)
passed at code head `43531de`. The existing
[coverage artifact 12603380229](https://github.com/0913vision/llpresenter/actions/runs/40203847027/artifacts/12603380229)
contains `native-fullscreen-order.log`. Successful verify steps suppress their
stdout, so the test also saves this diagnostic in the coverage artifact.

| Observation, in recorded order       | x   | y   | Width | Height |
| ------------------------------------ | --- | --- | ----- | ------ |
| Before fullscreen exit               | 0   | 0   | 1024  | 768    |
| During `leave-full-screen`           | 192 | 180 | 640   | 360    |
| After `setFullScreen(false)` returns | 192 | 180 | 640   | 360    |
| Next event-loop turn                 | 192 | 180 | 640   | 360    |
| Settled                              | 192 | 180 | 640   | 360    |

The leave event ran synchronously before the call returned. The bounds were
already restored when that event ran and stayed the same afterwards in this
probe. It did not reproduce a restore after the event; it did not disconnect a
physical monitor. The fix handles either ordering and a missing event without
relying on that timing assumption. The same real-window fixture passed its
planned-bounds assertion and fullscreen/always-on-top reconnect assertion. The
real HDMI recheck remains scheduled for when the user is awake.
