# Review request: `output-16`

- Team member: `output`
- Branch: `fix/output/image-background`
- Base commit (`main`): `0f5b01c95009459d777cd81e283e58d3d1092f76`
- Code commits: `3b3da98`, `91af9ee`, `23993a6`
- Review range: `0f5b01c...fix/output/image-background`
- Round 2 revision range: `109101b...fix/output/image-background`
- Related task: bug M2-7, QA's
  [image-background finding F2](../qa/m2-check/smoke.md), and the lead's batch
  in `.llp/task.md`.
- Shared contract changes: none.
- Status: round 2 ready; full verification passed all five steps in 93.4 s.

## What changed and why

A registered PNG was served correctly but never shown because the background
renderer treated every media ID as video. Chromium refused the PNG, and the
renderer waited for a `playing` event that could never arrive. Output windows
and all previews use that renderer, so both failed.

When the incoming source is rejected as unsupported video, the renderer now
loads the same URL into an image element. The still dissolves in only after its
`load` event. The previous picture remains while it loads and if it fails. The
unsupported-video event and `play()` rejection may arrive in either order; both
reach the same image attempt without a misleading playback error.

The existing two video elements remain, joined by a fixed pair of image
elements. Still pictures use the same cover layout and dissolve as video. The
image element composites its pixels over `var(--output-black)` before its
opacity is applied, so transparent areas fade to the output background along
with the rest of the picture. After the dissolve, a still releases the outgoing
media and keeps no video source or spare decoder. A supported video makes no
extra image request. Source replacement, clear, and disposal cancel image
listeners and release image sources. Other layers continue drawing over the
background.

## Tests that fail on the old code

Added nine image cases in each of output and preview mode. With the new tests
and the original `backgroundLayer.ts`, 18 tests failed because no image was
created; all 29 existing cases passed. Restoring the fix passed all 47.

Cases cover image readiness and dissolve, either video failure order, a loop
flag on a still, video-to-image and image-to-video transitions, image-to-image
transition with two reused elements, repeated media, clear, failed image,
replacement before load, and disposal. Failed loads keep the last good frame.

Two `OutputRenderer` cases also check that the image stays below the lyrics and
clears in the same render call, for output and preview mode. The scoped
renderer/output run passed all 86 tests in seven files.

## Actual app check

Before rebase, ran the built app entry offscreen with a local copy of QA's
original PNG and WebM fixture, through the existing preload live API. No windows
or dialogs appeared. The helper scripts passed `node --check`; the launch set
`LLP_TEST_WINDOWS=offscreen` and `windowsHide`, used an isolated data folder,
and had a 20 s deadline. It completed in 6.231 s and exited normally.

| Step                                | Output window and all three control previews                               |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Show the registered PNG, loop false | Image decoded at 1920 x 1080, opacity 1, object-fit cover; no video source |
| Switch to the WebM, loop true       | Video decoded at 1280 x 720 and playing; no image source                   |
| Switch back to PNG, loop true       | Same still displayed; no video source                                      |
| Clear media                         | All image and video sources removed                                        |
| Undo clear                          | Same PNG displayed again in all four views                                 |

The app logged no background start, playback, or image-load error. Captured and
viewed the output image: it contains QA's sunset picture.

Local ignored artifacts are under this worktree's `.llp/image-background/`:
`tests-old.log`, `tests-fixed.log`, `tests-scoped.log`, `app-proof.json`,
`app.log`, and `png-proof.png`. To repeat the app check from the output
worktree, run `node .llp/image-background/run-app.mjs` after building. The
harness copies the fixture into its own data folder and leaves the original
fixture unchanged.

## Changed files

- `src/renderer/src/render/backgroundLayer.ts`: image fallback, mixed media
  transitions, and bounded image lifetime.
- `src/renderer/src/render/backgroundImage.ts`: cancellable image load and
  listener cleanup.
- `src/renderer/src/render/classes.ts`, `layers.module.css`: image class with
  the existing video layout and opacity rules, plus an opaque output-background
  backing for stills.
- `src/renderer/src/render/backgroundLayer.test.ts`, `outputRenderer.test.ts`:
  image regressions and layer integration.
- This review document.

Round 2 adds `transparentBackground.node.test.ts` and its renderer and Electron
fixtures under `src/renderer/src/render/fixtures/` and
`src/main/windows/fixtures/` for actual pixel-compositing regression coverage.

## Round 1 checks

| Command or test                                  | Result                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| New image cases with the old background renderer | Expected failure: 18 failed, 29 passed                                                                 |
| Fixed background renderer                        | Pass: 47 tests                                                                                         |
| Scoped renderer/output tests, two workers        | Pass: 7 files, 86 tests                                                                                |
| `npm run typecheck`                              | Pass                                                                                                   |
| ESLint on changed TypeScript files               | Pass                                                                                                   |
| `npm run lint` after the braces correction       | Pass                                                                                                   |
| `npm run build`                                  | Pass                                                                                                   |
| Offscreen app image/video/clear/undo check       | Pass: 6.231 s, exit 0                                                                                  |
| `npm run format` and `npm run format:check`      | Pass                                                                                                   |
| `npm run verify`                                 | Exit 1: own lint error corrected; remaining test failure is a known load failure confirmed by the lead |

The full verification ran once after the conflict-free rebase. Typecheck (8.8
s), formatting (9.0 s), and build (3.1 s) passed. Lint failed because Prettier
wrapped an early-return condition without braces. Added the braces and reran the
scoped renderer/output tests: all 86 passed again. Full-repository
`npm run lint` and `npm run format:check` both passed after that correction.

Coverage ended after 303.4 s with 200 files passing and one failing: 2,230 tests
passed, one failed, and one was skipped. The failure is
`scripts/verify.test.ts` > `verify` > "stops every running step and its children
when interrupted", at `expect(isRunning(pid)).toBe(false)` on line 330. Its
teardown also reported
`could not end process 43264: taskkill exited with code 255`. That PID was no
longer running when checked after the test.

The lead subsequently ran `scripts/verify.test.ts` alone on main: all 20 tests
passed. The lead classified the failure above as load-related in an untouched
file and instructed output to record it as a known load failure and request
review. This meets the known-failure exception in `docs/WORKFLOW.md`. The files
belong to devops and were left unchanged. The full verify was not repeated. Raw
output is `.llp/image-background/verify.log`.

## Decisions and scope

- The live media contract and renderer URL refer to an ID without media kind or
  file extension. Use the browser's unsupported-source result to try image
  decoding; keep the shared schema, preload, main protocol, and shell callers
  unchanged.
- Keep a fixed number of elements and cancel each image listener when it settles
  or its source is no longer wanted. A source accepted by neither decoder
  reports one media failure and preserves the outgoing picture.
- Use the renderer's existing cover fit. Other media properties are outside this
  PNG display correction.
- Terminology changes belong to the next separate branch in the assigned batch.
  M3-O0 remains parked.

## Quality checklist

- [x] Round 2 full verification passes all five steps. Formatting passes. The
      round 1 known load failure remains documented above.
- [x] Image regressions fail on the old renderer and pass with the fix.
- [x] Output and preview paths, failed loads, transitions, and cleanup covered.
- [x] Fixed element count; no new cache, timer, object URL, or dependency.
- [x] Listeners and image/video sources released when no longer needed.
- [x] No shared contract, ownership, or input-validation changes.
- [x] No unsafe assertions, `any`, non-null assertions, or disallowed comments.

## Where to look

Check the unsupported-source paths in `handleError` and `play`, the image
cleanup helper, and the transition's choice of picture element. Verify that a
still never prepares a spare video, a late load cannot revive cleared media, and
a failed replacement keeps the previous picture.

## Review: lead

- Verdict: pending
- Findings:

## Review: reviewer

- Verdict: pending
- Findings:

## Team member's reply

### Round 1 findings (codex2)

1. Transparent PNGs revealed the outgoing picture until it was unloaded. Added
   `background: var(--output-black)` to `.image`. PNG pixels now composite
   against the same opaque background as the output root before the image's
   opacity is applied. The outgoing picture can remain during the dissolve and
   be unloaded afterward without changing the final pixels. The video handover,
   dissolve timer, and element lifetime remain as before.

   Fix commit: `23993a6`.

   Added a real Electron pixel regression that builds the production CSS in a
   temporary fixture page. It decodes an original PNG with transparent,
   half-alpha, and opaque bands. It keeps the outgoing picture visible while
   sampling incoming opacity 0, 0.5, and 1, then samples again after removing
   the outgoing picture. Fixed opacity checkpoints avoid machine-load timing
   dependencies. Both output and preview sizes are checked, and the preview
   overrides the output-background token to verify that the backing follows it.

   With the old CSS, the transparent pixel remained `[200, 200, 200]` at opacity
   0.5 and 1, then jumped to `[0, 0, 0]` when the outgoing image was removed.
   The new test failed at opacity 0.5: expected 100, received 200. After the
   correction it passes with the following values, within one byte per color
   channel; the opaque band stays at 200 throughout.

   | Background value | Transparent band at opacity 0 / 0.5 / 1 | Half-alpha band at opacity 0 / 0.5 / 1 | Values after outgoing removal, transparent / half-alpha |
   | ---------------- | --------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
   | 0, output size   | 200 / 100 / 0                           | 200 / 150 / 100                        | 0 / 100                                                 |
   | 32, preview size | 200 / 116 / 32                          | 200 / 158 / 116                        | 32 / 116                                                |

   Every Electron fixture launch requires `LLP_TEST_WINDOWS=offscreen` and uses
   hidden windows, a syntax check, temporary user data, a deadline, immediate
   frame-texture release, and window cleanup. No dependency was added. The
   fixture is separate from the app's renderer entries.

### Round 2 checks

| Check                                                   | Result                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| New pixel test against round 1 CSS                      | Expected failure: midpoint 200 instead of 100, followed by cleanup jump to 0 |
| Scoped renderer/output tests including pixel regression | Pass: 8 files, 87 tests                                                      |
| `npm run typecheck`                                     | Pass                                                                         |
| Targeted ESLint after formatting                        | Pass                                                                         |
| `npm run format`                                        | Pass                                                                         |
| `npm run verify`                                        | Pass: all 5 steps in 93.4 s, one invocation for round 2                      |

The single round 2 full verification passed: typecheck 5.3 s, lint 58.1 s,
format check 10.0 s, coverage tests 93.3 s, and build 2.7 s. Wall time was 93.4
s. No step failed or needed a rerun. Only review-result recording and formatting
followed the full verification; the source correction is `23993a6`.

Local logs: `.llp/image-background-round2/tests-old.log`, `tests-fixed.log`,
`lint.log`, and `verify.log`. The round 1 known-load exception remains recorded
as history; the round 2 run passed without that exception.
