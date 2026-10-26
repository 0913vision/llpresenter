# Review request: `output-38`

- Team member: `output`
- Branch: `feat/output/picture-correction`
- Base and range: in the review request message.
- Scope: M3-O9b, the 가장자리 여백 (edge margin) and 위치 미세 조정 (position
  fine-tuning) part: the saved `edgeMargin` and `offset` of a screen applied to
  its whole picture. The test pattern follows as output-39.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## Shared contract changes (review first)

- `src/shared/screens.ts`: `CAPTURE_WINDOW_SIZE` (1920 x 1080, the client size
  of a capture window with no saved resolution) moves here from
  `src/main/outputs/placement.ts`, unchanged, so the renderer reads the same
  default. Additive: main imports it from the new place; nothing else changes.

## What changed and why

- `RenderScreen` (`render/layer.ts`) gains `pixels`, the screen's own pixel
  size, and `correction`, its `edgeMargin` (percent) and `offset` (x and y in
  the screen's own pixels). `resolveRenderScreen` fills `correction` only when
  the margin or an offset isn't 0, so an uncorrected screen draws as before.
  `pixels` is the monitor's real pixels for 전체 화면 (saved bounds times the
  Windows scale), the set resolution for the capture window
  (`CAPTURE_WINDOW_SIZE` when none is set), the set resolution for NDI when
  there is one, and absent for 창. The test pattern (output-39) prints it as the
  screen's resolution.
- `pictureTransform` (`render/pictureCorrection.ts`, new): spec 03's rule as a
  CSS transform. Margin m % scales to (100 - 2m) % around the centre, 0 from 50
  % on. The offset converts to the surface's CSS pixels by the share of the
  screen it covers (`surface / pixels` per axis), or by `1 / devicePixelRatio`
  when the screen has no pixel size. A picture drawn smaller, such as a lost
  monitor's 960 x 540 window or a preview, therefore moves by the same share. It
  returns null for an uncorrected picture.
- `OutputRenderer` sets the transform as the `--picture-transform` custom
  property on its root, and every layer box reads it (`layers.module.css`). The
  root itself never moves, so the margin shows the screen's empty color (black,
  the capture green, or the Look's background), and anything moved past the edge
  is clipped by the root's `overflow: hidden`. It writes the property only when
  the transform string changes, recomputes on a new correction object or a size
  change (the existing ResizeObserver), and skips the work when the same
  correction object comes again, so a live state change allocates nothing.
- Spec 03: how the screen's own pixels are counted per method, and that previews
  draw the corrected picture as the screen shows it (both proposals).

## Changed files

- `src/renderer/src/render/layer.ts`, `screenIdentity.ts`, `outputRenderer.ts`,
  `layers.module.css`, and their tests.
- `src/renderer/src/render/pictureCorrection.ts` (new), its unit test, and a
  node test that reads `layers.module.css`.
- `src/shared/screens.ts`, `src/main/outputs/placement.ts`.
- `docs/spec/03-output.md`.

## Changes outside my paths

- `src/shared/screens.ts` (data): the additive constant above.

## Checks run

| Command or test                                                                                                    | Result                                   |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `npm run typecheck`                                                                                                | Pass                                     |
| `npx vitest run src/renderer/src/render src/renderer/src/output src/renderer/src/show src/main/outputs src/shared` | Pass, 1846 tests (the native test skips) |
| `npx eslint` and `npx prettier --check` on the changed files                                                       | Pass                                     |
| Mutation checks (`.llp/output-38/mutations.log` in the worktree)                                                   | 17 mutations, see below                  |
| `npm run verify`                                                                                                   | GitHub CI only (see the request message) |

Sixteen mutations fail a test. Five of them survived the first run and fail
since the commits that pin them (the log shows both runs): the y axis using the
width, an offset-only correction, the same correction coming again, and the CSS
rule. After `pixels` moved to `RenderScreen`, the affected mutations ran again
and fail a test, along with two new ones (the pixel size left out of the screen
or of the transform). The seventeenth showed that a `pixels > 0` guard was dead
(the schema allows only positive pixel counts), so the guard is gone.

Tests: the margin scale, the offset in screen pixels on a full size, a quarter
size, and a non-16:9 surface, device pixels without a screen size, a margin of
half or more, and no transform for an uncorrected picture; the correction and
pixel size per method, and offset-only corrections; the renderer writing,
keeping, recomputing on resize, and removing the property; and the CSS rule that
every layer box reads it while the root, with its background, stays.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI, see the request message)
- [x] `npm run format:check` passes (changed files)
- [x] Every new behavior has unit tests
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every listener and timer is released
- [x] An exception in the output path doesn't stop the output
- [x] The clean code rules and comment rules in `CLAUDE.md` hold
- [x] The change is small and focused

## Decisions I made (for the lead to confirm)

1. The screen's own pixels per method, as above; a capture window counts its set
   resolution rather than the device pixels of the control monitor.
2. Previews (the 진행 screen previews) draw the corrected picture, so they match
   the screen.
3. The margin area shows the screen's empty color, the Look's background
   included, rather than a fixed black.

## Shared contract change requests

None beyond the additive constant.

## Where to look

- `pictureCorrection.ts`: `pictureTransform`.
- `outputRenderer.ts`: `setCorrection` and `applyCorrection`.
- `screenIdentity.ts`: `screenPixels`.
- `layer.ts`: `RenderScreen.pixels` and `correction`.

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
