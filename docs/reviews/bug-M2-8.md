# Bug M2-8: The GPU process's memory keeps rising in a 60-minute soak

- Severity: to decide (it may be a test-mode artifact or a cache that levels off
  later). Owner: output. Found by qa's 60-minute soak (`docs/qa/m2-notes.md`,
  the soak-3 section; `docs/reviews/qa-7.md`).

## What was seen

- Scenario: the same as soak runs 1 and 2 (the 본 화면 on, a looping 1080p
  background video of 5 MB and 10 s, a 슬라이드 change every 5 s), 60 minutes,
  offscreen windows (`LLP_TEST_WINDOWS=offscreen`), on `main` b7c61e3, while
  other sessions loaded the machine.
- Trends of the lowest private memory per window, whole run and last 30 minutes
  (MiB/h), and the peaks (MiB):
  - GPU: +8.77 and +13.18, peak 474.9 (growing in both halves).
  - main: +2.38 and +0.86, peak 87.4 (flat).
  - control: +1.64 and -0.96, peak 137.0 (flat).
  - output: +8.69 and +0.71, peak 101.1 (flat in the later half).
- Output at 60 fps throughout; no errors or restarts in 359 samples.

## Where to look

- `output-15`: offscreen windows now request GPU shared textures and release
  each one in the `paint` listener. A texture that is not released (a paint that
  arrives after a listener is removed, an exception before the release, a window
  that is hidden) would grow the GPU process in test mode only.
- The video layer: how a looping video is decoded and whether decoder or texture
  memory is held per loop or per 슬라이드 change
  (`src/renderer/src/render/backgroundLayer.ts`, the preview mode).
- The 슬라이드 layer and the previews: textures or canvases created per change.
- Chromium's own GPU caches (shader and image caches), which grow until a limit.

## Questions

- Is the growth in the test-only offscreen path, or would a visible window show
  it too?
- Is it proportional to the loop count, the 슬라이드 changes, or time?
- Does a known Chromium cache limit explain the rate and where it would stop?
