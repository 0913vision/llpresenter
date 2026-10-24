# Review request: `output-12`

Review range: `342a9b8...feat/output/preview-mode` (round 2). For round 2, check
the two round 1 findings in "Team member's reply", both fixed in `7cb1656`.
Check that a renderer in `preview` mode keeps one video playing per background
in steady state, still dissolves to a new background, and holds the last frame
of one that doesn't loop, and that output windows (`output`, the default) are
unchanged. The preview rule is in `docs/spec/04-show.md` ("Preview panel").

- Team member: `output`
- Branch: `feat/output/preview-mode`
- Base commit (`main`): `342a9b8` (round 2; round 1 was on `7c37c7c`)
- Last commit: the commit that adds this file
- Related: shell's three live previews in the control window; the lead's pick

## Changes outside my paths

None.

## What changed and why

shell mounts one `OutputRenderer` per live preview in the control window. With
the output window's two-video loop handover, three previews would keep six video
decoders running and hand over on every loop, for hours.

- `OutputRendererOptions` and `BackgroundLayerOptions` gain an optional
  `mode: 'output' | 'preview'` (`RenderMode`), `output` when absent.
- In `preview` mode, a looping background loops natively (`video.loop`) on the
  one video that shows it, or is about to show it while it starts, so `ended`
  never hands over. Every other video has its native loop off, so an outgoing
  background holds its last frame as in an output window. The other video is
  used only for the 0.5 s dissolve to a new background and is unloaded right
  after it. In steady state a preview holds one decoder; the loop point may
  hitch for a frame, which a small preview can afford.
- Everything else is the same as in an output window: the layers, the lyric
  style, the dissolves, the instant clears, and the seek by start time, so the
  preview matches the screen.

## Changed files

- `src/renderer/src/render/backgroundLayer.ts`, `outputRenderer.ts`, and their
  tests
- `docs/reviews/output-12.md` (new)

## Checks run

Round 2: `npm run verify` passed on `7cb1656`, on `main` at `342a9b8`: 5 steps
in 208.8 s. New round 2 tests: a loop change before the next background plays
reaches its video, in both directions, and stays after it plays; the outgoing
video's native loop is off while the next background is slow to start (the
delayed handover test now runs in both modes); the old background doesn't start
looping when the new one fails to start and is shown again.

Round 1, on `f4b89a0`, on `main` at `7c37c7c`:

| Command or test  | Result                                                                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Passed, 5 steps in 227.2 s                                                                                                                                                                                                                                                                                        |
| New tests        | In a preview: native loop on the showing video, the other video unloaded after the dissolve, `ended` hands nothing over; a new background still dissolves on the other video; a loop change on the same background reaches the video; an output window never loops natively; the renderer passes the mode through |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (no change)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the spare video is unloaded after
      each dissolve in a preview)
- [x] Caches and lists have size caps (no change)
- [x] An exception in the output path doesn't stop the output (no change)
- [x] Only what's needed re-renders (control window): unchanged layers are still
      skipped
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: not measured; one decoder instead of two per
      preview follows from the design

## Decisions I made (for the lead to confirm)

1. The preview rate (30 fps) isn't applied to video: a video element decodes at
   its own rate whatever the box size. Halving the decoders is the saving
   available without drawing video into a canvas.

## Shared contract change requests

None.

## Where to look

- `src/renderer/src/render/backgroundLayer.ts`, `loopNativelyInPreview` and
  `prepareSpare`.
- Round 2: `loopNativelyInPreview` now sets every video from the pending
  handover or the front, and runs after `start` sets the handover.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (6594ab3, codex4): Request changes with two findings: a loop change
  before the incoming video played reached the outgoing one, and the outgoing
  preview video kept its native loop during a handover.
- Round 2 (baa00e0): reviewer (Codex, codex4) Approve with no findings. Lead
  Approve; a preview loops its background natively on the one video that shows
  the current background, which spares decoders, and the output keeps its own
  handover. Rebased by the lead onto local `main` without conflicts.

## Team member's reply

Round 1 findings (codex4), both fixed in `7cb1656`:

1. `backgroundLayer.ts`: a loop change before the incoming video played went to
   the front video, which still held the outgoing background. Now
   `loopNativelyInPreview` sets the native loop on the video of the pending
   handover, or the front video when none is pending, and only when that video
   holds the current background. Tests: both directions before the incoming
   video plays, and a failed start that is shown again.
2. `backgroundLayer.ts`: starting a replacement left the outgoing video's native
   loop on. The same method turns it off on every video that doesn't show the
   current background, so the outgoing one holds its last frame as in an output
   window. The delayed handover test now runs in both modes and checks the
   outgoing video's loop.
