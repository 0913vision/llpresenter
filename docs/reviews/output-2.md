# Review request: `output-2`

Review range: `6559a9b...feat/output/render` (round 3). Check the round 1
findings against "Team member's reply", the output path against
`docs/spec/03-output.md` (layers, drawing text, background playback, undo), and
the media file boundary in `src/main/windows/`.

- Team member: `output`
- Branch: `feat/output/render`
- Base commit (`main`): `6559a9b` (round 3; round 2 was on `97e76ef`, round 1 on
  `b9392d0`)
- Last commit: the commit that adds this file
- Related brief: `docs/briefs/output.md` (task 2), milestone M2

## Changes outside the render and output folders (read first)

- `src/main/live/reducer.ts` and `store.ts`: a new background gets `startedAt`
  from the store's clock (`applyCommand` takes `now`), and the same background
  shown again keeps playing and keeps its start time. The store takes an
  optional clock for tests. Codex's output-3 nit (outputs on and off keep the
  undo) is in `reducer.test.ts`.
- `src/main/ipc.ts`: `listenToWindows(channel, handler)` for fire-and-forget
  window messages, and `log:write` registered with a per-window rate limit.
- `src/main/index.ts`: registers the `llp-media` scheme before the app is ready
  and serves it after; the resolver is a placeholder (TODO) until the file store
  has the media library, so no media id resolves yet.
- `src/main/index.test.ts`: the Electron mock gains `protocol`, a test checks
  the scheme registration, the bad-folder exit is checked against a log write
  held back 50 ms (Codex's output-4 nit), and the entry tests get 30 s because
  each imports the whole main process under coverage.
- `src/renderer/index.html` and `output.html`: `llp-media:` in `img-src` and
  `media-src`. `output.html` now loads `src/output/main.ts` into `#root`.
- No change to `src/shared/` or `src/preload/`: the channels, the media URL
  helpers, and `MediaLayer.startedAt` came from data-5.

## What changed and why

The output page now draws the live state: a 장 over a looping background video
on the 본 화면, with clears and undo reflected in the same call.

| Module                                              | Responsibility                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render/lyricStyle.ts`                              | The lyric style fields, the 기본 values from the `Looks` board (TODO until Looks reach the renderer), and the 1920 x 1080 scale.                                                                                                                                                                    |
| `render/fitText.ts`                                 | Pure: the largest whole-pixel size at which the text fits, never under a quarter of the style size.                                                                                                                                                                                                 |
| `render/slideLayer.ts`                              | The lyrics layer: two pages take turns so a 장 dissolves in 0.2 s; rows are reused; a clear is instant; the same 장 again isn't redrawn; the font shrinks until the 장 fits its maximum lines.                                                                                                      |
| `render/backgroundLayer.ts`                         | The media layer: two video elements for its whole life. A loop hands over to the spare, loaded at the start, on `ended`, so there is no gap; a new background dissolves in over 0.5 s; a clear unloads both videos at once; a background that started earlier seeks to where the other screens are. |
| `render/outputRenderer.ts`                          | One screen's layers bottom up, each drawn in its own `try`, scaled to its box with a `ResizeObserver`. Shell will reuse it for the 진행 previews.                                                                                                                                                   |
| `render/classes.ts`, `layers.module.css`            | The CSS module, with names that are never undefined for `classList`.                                                                                                                                                                                                                                |
| `output/liveFeed.ts`                                | Follows the live state from `window.llp`, dropping states older than the last.                                                                                                                                                                                                                      |
| `output/frameRateMeter.ts`                          | Counts frames with `requestAnimationFrame` and reports the rate once a second.                                                                                                                                                                                                                      |
| `output/startOutput.ts`, `main.ts`, `output.css`    | The output page: draws the live state, sends drawing and uncaught errors to the main log (never shown), reports the frame rate with its screen id, hides the cursor.                                                                                                                                |
| `main/rendererMessages.ts`                          | Validates `log:write` and `output:frame-rate` with data's schemas; `WindowLogLimiter` lets each window write 20 lines a second and logs how many it dropped.                                                                                                                                        |
| `main/outputs/frameRates.ts`                        | The last rate per screen; a status turns low after 2 s more than 10% under 60 fps and back after 2 s at the target (spec 03).                                                                                                                                                                       |
| `main/windows/mediaResponse.ts`, `mediaProtocol.ts` | Serves library media by id over `llp-media:` with single byte ranges, so video can stream and seek; unknown ids and missing files answer 404 and are logged, never thrown.                                                                                                                          |

## Changed files

- `src/renderer/src/render/` (new), `src/renderer/src/output/` (new),
  `src/renderer/output.html`, `src/renderer/index.html`
- `src/main/rendererMessages.ts` (new), `src/main/outputs/frameRates.ts` (new),
  `src/main/outputs/start.ts`, `src/main/windows/mediaResponse.ts` (new),
  `src/main/windows/mediaProtocol.ts` (new), `src/main/ipc.ts`,
  `src/main/index.ts`, `src/main/live/reducer.ts`, `src/main/live/store.ts`
- Tests next to each, and `docs/reviews/output-2.md` (new)

## Checks run

Round 3: `npm run verify` passed on `1133b0d`, rebased onto `main` at `6559a9b`
without conflicts: 5 steps in 241.4 s, 139 test files and 1,506 tests.

Round 2: `npm run verify` passed on `a46f48e` (findings 1 to 8, rebased onto
`main` at `97e76ef` without conflicts): 5 steps in 222.2 s, 113 test files and
1,178 tests. The last commit, `ceb399e` (qa's log note), changes one `catch` and
adds one test; its renderer tests, lint, and format pass.

qa ran round 1 (`4ee5af1`) in a built clone on an invisible window before
review: the loop handover takes one frame with no dark or frozen tick, the 장
dissolve takes about 0.2 s, the same 장 again makes no DOM change, a 6-line 장
shrinks, clear and undo work, a killed renderer seeks back to its position, and
a 10-minute soak shows no growth (a 30-minute run is going).

Round 1:

On `9f0c7e3`, on `main` at `b9392d0`.

| Command or test     | Result                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`    | Passed, 5 steps in 270.7 s: typecheck, lint, format check, 98 test files and 980 tests with coverage, build              |
| New tests           | 13 test files in `render/`, `output/`, and the main process; the background layer tests drive the two videos with events |
| The app on a screen | Not run: no window may appear on the user's screen. See "Where to look"                                                  |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (both new
      channels, through data's parse functions; media URLs through
      `mediaIdFromUrl`)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (two video elements per renderer for
      its whole life, unloaded on clear and dispose; the resize observer, the
      frame loop, the live subscription, and the window error listeners stop on
      dispose)
- [x] Caches and lists have size caps (rows per page follow the 장; the limiter
      remembers at most 32 windows)
- [x] An exception in the output path doesn't stop the output (each layer in its
      own `try`; errors go to the main log; a bad media request answers an error
      status)
- [x] Only what's needed re-renders: unchanged layers are skipped
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [ ] The change is small and focused: it is the whole output-2 task, split into
      17 commits that each do one thing
- [ ] Measured performance values: the frame rate is reported, but not measured
      on a real monitor here (no window on the user's screen)

## Decisions I made (for the lead to confirm)

1. **Plain DOM, not React, in the output page.** Two pages and two videos are
   created once and reused, and nothing re-renders per 장, so the page stays
   small and predictable over hours. The previews can still mount the same
   `OutputRenderer` from React.
2. **Byte ranges served by our own handler**, not `net.fetch` of a `file:` URL,
   because Electron's typings don't say that `net.fetch` honors `Range`, and
   seeking depends on it.
3. **Seeking only beyond 0.5 s**, so a new background starts clean instead of
   seeking a few milliseconds in.
4. **The undo restores a background from its original start time**, so after an
   undo it plays where it would have been, not where it was cleared (spec 03
   proposes the latter; it needs the clear time in the live state).
5. **Images, sound, and the media properties** (range, speed, fit, volume) are
   not in this request; backgrounds are videos with `object-fit: cover`.

## Shared contract change requests

None in this request. Sent to data for later: the output status snapshot
(placement, renderer state, frame rate) with a get, a push, and a retry command,
for spec 08's restart cards and the toolbar's amber state.

## Where to look

- `src/renderer/src/render/backgroundLayer.ts`: the handover between the two
  videos (`handlePlaying`, `handleEnded`, `prepareSpare`).
- `src/renderer/src/render/slideLayer.ts`, `fit`: the shrink rule.
- `src/main/windows/mediaResponse.ts`, `parseRange` and `createFileResponse`.
- A manual check on two monitors that I couldn't do: a looping video plays
  without a visible hitch at the loop point, and the lyrics dissolve.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (4ee5af1): reviewer (Codex, codex2) Request changes: the video could
  sit above the lyrics, an early loop could replay the outgoing background,
  media paths had no containment check, shrink to fit stopped at a quarter size,
  undo resumed at the wrong position, a late reply could render after dispose,
  the low-fps warning cleared below target, and a nit.
- Round 2 (20e6ef5): reviewer (Codex, codex5) Request changes: a third
  background during a dissolve could show black, and a test nit.
- Round 3 (cbeb453): reviewer (Codex, codex5) Approve, no findings. qa tested
  the branch in the built app before merge (gapless loop, dissolves, clear and
  undo, seek after a restart, a 10-minute soak with no trend). Lead Approve.
  Rebased by the lead onto local `main` without conflicts.

## Team member's reply

1.

Round 1 findings (codex2), one commit each:

1. **Video above the lyrics (`backgroundLayer.ts:190`)**: fixed in `a32f577`.
   `OutputRenderer` now gives each layer a positioned box with its place in the
   order as its z-index, so each layer is its own stacking context and a video's
   z-index stays inside the background box. Test: with a playing video (z-index
   1), the background box's z-index is below the lyrics box's, and the video
   lives only in the background box.
2. **The spare still holding the outgoing background
   (`backgroundLayer.ts:207`)**: fixed in `416889d`. Each video now records the
   media it holds. A loop hands over only to a spare that holds the current
   background and is ready; otherwise the front video restarts itself. An
   `ended` from a video that doesn't hold the current background (the outgoing
   one during a dissolve or a slow start) is ignored, so it stays on its last
   frame. Tests: a short clip that ends during the dissolve restarts itself and
   never plays the old background; the outgoing background ending while the next
   one is slow to start is ignored; a background sought near its end loops on
   itself and uses the spare only once it holds the same media.
3. **Media files outside the media folders (`mediaResponse.ts:125`)**: fixed in
   `0b1d598`. The handler takes `mediaRoots`, and `realPathInside`
   (`windows/insideRoots.ts`) resolves the file's real path (links and `..`
   resolved, the roots too) and accepts it only inside a root; anything else
   answers 404 and is logged. The placeholder in `index.ts` passes no roots.
   Tests: an encoded id that climbs out of the folder, a file reached through a
   junction, the root itself, a missing file, and no roots are all refused.
4. **The quarter-size floor (`fitText.ts:17`)**: fixed in `b4f6430`. The search
   now runs down to 1 px, so every line fits; only text that fits at no size
   gets 1 px. Test: an oversized 장 that fits only at 3 px gets 3 px.
5. **Undo counted the time spent cleared (`backgroundLayer.ts:33`)**: fixed in
   `31e9b18`, in the reducer, where the start time lives. The undo entry records
   when the clear happened, and an undo that brings back a cleared background
   moves its start time by the time it was down, so it resumes at the clear
   position. A background that a lyrics clear left playing keeps its start time.
   Tests: clear at 5 s and undo 10 s later resumes at 5 s; a lyrics clear and
   undo leave the background's start time alone.
6. **A late initial reply after stop (`liveFeed.ts:23`)**: fixed in `31a99fa`. A
   `stopped` flag guards both the state and the error callback. Test: an answer
   and a rejection that arrive after stop reach neither callback.
7. **Recovery below the target (`frameRates.ts:25`)**: fixed in `11e9fee`. A low
   status now needs 2 s at the target (60 fps, within 0.5 fps because the meter
   reports one decimal) to return to normal; 54 to 59 fps keeps it low, and a
   normal status still turns low only below 54. Tests: 57 fps stays low, 59.8
   fps recovers, and 56 fps never turns a normal status low.
8. **Nit, TSDoc on unexported code**: fixed in `a46f48e`, for
   `MAX_TRACKED_WINDOWS` (moved into the class doc) and three more I found:
   `MIN_FONT_SIZE`, `LAYER_ORDER`, and `createLayerBox` (the last two kept as
   `NOTE(0913vision)` comments).

From qa's pre-merge run: an `AbortError` from `play()` interrupted by our own
pause or source change was logged at error level. `ceb399e` treats that one
rejection as expected; other play failures are still reported. Test: an
interrupted play during a clear reports nothing.

Round 2 findings (codex5):

1. **A third background during the dissolve (`backgroundLayer.ts:134`)**: fixed
   in `42daff5`. Before a background loads into the other video, any dissolve
   still running ends at once: the front video loses its `dissolving` class, so
   it is fully opaque, and the video about to be reused is hidden (no `shown`,
   back z-index) before its source changes. No black can show under the front,
   and the next background fades in fresh when it plays. Regression test: A,
   then B playing and dissolving, then C at once: the reused video is hidden and
   holds C, B is opaque, and C fades in with `dissolving` on top when it plays.
   It fails on the old code (the reused video stayed shown).
2. **Nit, the late reply test (`liveFeed.test.ts:84`)**: split in `1133b0d` into
   two tests with fresh promises: a state that arrives after stop, and a failure
   that arrives after stop.
