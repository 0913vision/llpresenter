# Review request: `output-2`

- Team member: `output`
- Branch: `feat/output/render`
- Base commit (`main`): BASE_COMMIT
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

CHECKS

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
