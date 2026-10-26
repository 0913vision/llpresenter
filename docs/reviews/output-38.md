# Review request: `output-38`

- Team member: `output`
- Branch: `feat/output/picture-correction`
- Base and range: in the review request message.
- Scope: M3-O9b, the 가장자리 여백 (edge margin) and 위치 미세 조정 (position
  fine-tuning) part: the saved `edgeMargin` and `offset` of a screen applied to
  its whole picture. The test pattern follows as output-39.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## What changed and why

The text below describes the change as it stands after round 1; the reply at the
end says what changed in round 2.

- `RenderScreen.correction` (`render/layer.ts`): the screen's `edgeMargin`
  (percent) and `offset` (x and y in reference px). `resolveRenderScreen` fills
  it only when the margin or an offset isn't 0, so an uncorrected screen draws
  as before.
- `pictureTransform` (`render/pictureCorrection.ts`, new): spec 03's rule as a
  CSS transform. Margin m % scales to (100 - 2m) % around the centre, 0 from 50
  % on. The offset counts pixels of a 1920 x 1080 reference picture and is
  scaled by the same factor as lyric sizes (`scaleFor`), so a preview, a lost
  monitor's window, and a 4K output all move by the same share of the picture
  (the lead's decision in spec 03). It returns null for an uncorrected picture.
- `OutputRenderer` sets the transform as the `--picture-transform` custom
  property on its root. Only the root's own layer boxes read it
  (`.root > .layer`), so the boxes that layers nest inside themselves, which
  share the `.layer` class, never scale it again (a NOTE). The root itself never
  moves, so the margin shows the screen's empty color (black, the capture green,
  or the Look's background), and anything moved past the edge is clipped by the
  root's `overflow: hidden`. It recomputes on a new screen object or a size
  change (the existing ResizeObserver, which also gives the scale), writes the
  property only when the transform string changes, and skips the work when the
  same screen object comes again, so a live state change allocates nothing.
- Spec 03: the offset unit (lead decision, October 26) and that previews draw
  the corrected picture (proposal).

## Changed files

- `src/renderer/src/render/layer.ts`, `screenIdentity.ts`, `outputRenderer.ts`,
  `layers.module.css`, and their tests.
- `src/renderer/src/render/pictureCorrection.ts` (new), its unit test, a node
  test of the stylesheet, and a test on the production DOM.
- `docs/spec/03-output.md`.

## Changes outside my paths

None. (Round 1 moved `CAPTURE_WINDOW_SIZE` to `src/shared/screens.ts`; the unit
change made it unneeded, so that file is unchanged now.)

## Checks run

| Command or test                                                                                         | Result                                   |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                                                                     | Pass                                     |
| `npx vitest run src/renderer/src/render src/renderer/src/show src/renderer/src/output src/main/outputs` | Pass, 696 tests (the native test skips)  |
| `npx eslint` and `npx prettier --check` on the changed files                                            | Pass                                     |
| Mutation checks (`.llp/output-38/mutations.log` in the worktree)                                        | All fail a test (see below)              |
| `npm run verify`                                                                                        | GitHub CI only (see the request message) |

Every mutation of the current code fails a test: the margin clamp and factor,
each axis of the offset, the scale kept from the resize, the screen identity
skip, the transform string skip, the property removal, the reapply on resize,
the correction only when it changes something, and the CSS rule narrowed back to
`.layer`. The log also holds round 1's runs of code that is gone now.

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

1. Previews (the 진행 screen previews) draw the corrected picture, so they match
   the screen.
2. The margin area shows the screen's empty color, the Look's background
   included, rather than a fixed black.

## Shared contract change requests

None.

## Where to look

- `pictureCorrection.ts`: `pictureTransform`.
- `outputRenderer.ts`: `setCorrection` and `applyCorrection`.
- `layers.module.css`: the `.root > .layer` rule.
- `layer.ts`: `RenderScreen.correction`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex4): Request changes: the transform compounded on nested
  `.layer` boxes (a 10% margin drew at 64% or 51%), and offsets depended on
  pixel sizes that previews and changed monitors didn't share.
- Round 2 (9a0d19e4): reviewer (Codex, codex4) Approve, no findings. Lead
  Approve after reading the transform: one rule on the root's direct children,
  and the margin clamped at zero. 위치 미세 조정 counts 1920×1080 reference
  pixels scaled like lyric sizes (lead decision, October 26, spec 03), so
  previews and resolution changes keep the same share. Rebased by the lead onto
  local `main` without conflicts; typecheck passes.

## Team member's reply

Round 1 (codex4, Request changes):

1. [P1] Compounded transform: fixed in `6762f600`. The rule is now
   `.root > .layer`, so only the layer boxes the renderer puts on its root take
   the correction, and the `.layer` boxes that the background, the 장, and the
   소품 nest inside them don't. Tests: a node test reads `layers.module.css` and
   finds the transform declared in exactly one rule, `.root > .layer`; a test on
   the production DOM (background video, 장, and a text 소품 drawn by the real
   `OutputRenderer`) finds more than two nested `.layer` boxes and checks that
   `.root > .layer` matches exactly the one box per layer and none of them.
2. [P2] Window-method previews and 3. [P2] saved display size: resolved by a
   unit change the lead decided (spec 03, "lead decision, October 26"). An
   offset now counts pixels of a 1920 x 1080 reference picture and scales with
   the drawn picture by the same factor as lyric sizes, so no screen pixel size
   is read or reported anywhere: `RenderScreen.pixels` and the saved display
   lookup are gone, and so is the `CAPTURE_WINDOW_SIZE` move. A 240 px preview
   of a 960 px 창 output moves by a quarter of what the output does, and a
   monitor that goes from 1920 to 3840 px keeps the same share without touching
   the screen settings. Test (`outputRenderer.test.ts`): one correction of 40
   and -20 px draws 40 and -20 at 1920 x 1080, 80 and -40 at 3840 x 2160, and 10
   and -5 at 480 x 270, the same share of the width each time.
