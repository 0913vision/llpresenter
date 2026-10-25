# Review request: `output-16`

- Team member: `output`
- Branch: `fix/output/image-background`
- Base commit (`main`): `0f5b01c95009459d777cd81e283e58d3d1092f76`
- Code commits: `3b3da98`, `91af9ee`
- Review range: `0f5b01c...fix/output/image-background`
- Related task: bug M2-7, QA's
  [image-background finding F2](../qa/m2-check/smoke.md), and the lead's batch
  in `.llp/task.md`.
- Shared contract changes: none.
- Status: prepared; review request held by the unrelated verification failure
  described below.

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
elements. Still pictures use the same cover layout and dissolve as video. After
the dissolve, a still releases the outgoing media and keeps no video source or
spare decoder. A supported video makes no extra image request. Source
replacement, clear, and disposal cancel image listeners and release image
sources. Other layers continue drawing over the background.

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
  the existing video layout and opacity rules.
- `src/renderer/src/render/backgroundLayer.test.ts`, `outputRenderer.test.ts`:
  image regressions and layer integration.
- This review document.

## Checks run

| Command or test                                  | Result                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| New image cases with the old background renderer | Expected failure: 18 failed, 29 passed                                 |
| Fixed background renderer                        | Pass: 47 tests                                                         |
| Scoped renderer/output tests, two workers        | Pass: 7 files, 86 tests                                                |
| `npm run typecheck`                              | Pass                                                                   |
| ESLint on changed TypeScript files               | Pass                                                                   |
| `npm run lint` after the braces correction       | Pass                                                                   |
| `npm run build`                                  | Pass                                                                   |
| Offscreen app image/video/clear/undo check       | Pass: 6.231 s, exit 0                                                  |
| `npm run format` and `npm run format:check`      | Pass                                                                   |
| `npm run verify`                                 | Fail: own lint error corrected; unrelated process-test failure remains |

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

This exact test is not identified as an allowed flaky test in the repository, so
`docs/WORKFLOW.md` blocks the review request until the lead or devops resolves
or classifies it. The files belong to devops and were left unchanged. The full
verify was not repeated. Raw output is `.llp/image-background/verify.log`.

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

- [ ] Full verification and formatting pass.
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

None yet.
