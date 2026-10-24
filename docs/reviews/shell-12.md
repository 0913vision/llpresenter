# Review request: `shell-12`

Review range: 94780dc...feat/shell/previews

What to check in round 2: the four findings and the nit of round 1 ("Team
member's reply", items 1 to 5): the stable tree of `PreviewPanel` (three
previews in a fixed order, roles changed by class), the shrink rule in
`PreviewPanel.module.css` and `ScreenPreview.module.css` with the measurements
below, and the new tests in `PreviewPanel.test.tsx`.

What to check: (1) the preview panel against `docs/spec/04-show.md`, "Preview
panel": one large and two small previews in the fixed order, a click swaps with
no transition, the large one is not clickable, each preview draws the live
layers through the output renderer and never follows the selection, an output
that is off keeps its picture with a dim name and a lighter frame, and the 방송
자막 frame is green; (2) the lifetime of each `OutputRenderer` (one per preview,
created on mount, drawn from a store subscription that does not render React,
disposed on unmount); (3) the removal of the next-장 helpers
(`layersWithNextSlide`, `useNextSlideLayer`), which the spec dropped; (4) the
panel sizes in the right column (content height for the preview, at least 240
for the 진행 도구); (5) one test case that the shell-11 nit asked for.

- Team member: `shell`
- Branch: `feat/shell/previews`
- Base commit (`main`): `94780dc`
- Last commit: see the commit that adds this file
- Related brief: the lead's M2 task "previews"

## What changed and why

1. **The preview panel.** `PreviewPanel` shows the 본 화면, 무대 화면, and 방송
   자막 as one large preview with a caption (screen name, target, and look name)
   and two small previews under it. The small ones keep the order 본 화면, 무대
   화면, 방송 자막 without the large one. A click on a small one makes it large
   and moves the large one into the row, and the large one is not a button. The
   narrow window form turns the small previews into rows (64 px frames). The
   large screen is kept in `state/preview.ts` (a `TODO` for `app.json`).
2. **The picture.** `ScreenPreview` mounts the output renderer
   (`render/OutputRenderer`, output-2) into a 16:9 frame with the default lyric
   style and the media URL, draws the live layers, and follows the live store
   through a subscription, so a live change does not render React. Drawing
   errors go to the main log. It never reads the selection, so moving the
   selected tile or opening another item changes no preview. A clear takes the
   layer away because the renderer draws the live layers.
3. **States.** A screen whose output is off keeps drawing, with a dim name, a
   lighter frame, and the tooltip "본 화면 출력이 꺼져 있습니다". The 방송 자막
   frame is chroma green when empty (the frame and the renderer's root
   background are green, and `--output-black` is not overridden).
4. **Dead code removed.** The spec dropped the next-장 preview, so
   `layersWithNextSlide` and `useNextSlideLayer` (and their tests) are gone, and
   `previewLayers.ts` became `slideLayer.ts`, which only holds `slideLayerOf`.
5. **Right column sizes.** The 미리보기 panel is as tall as its content (it
   shrinks before the 진행 도구 does), and the 진행 도구 panel is at least 240
   px.
6. **The nit of shell-11:** a test changes the layers and `canUndo` together and
   expects exactly the changed buttons to draw.

## Changed files

- `src/renderer/src/show/` (`PreviewPanel.tsx` and CSS, `ScreenPreview.tsx` and
  CSS, `slideLayer.ts`, and the tests)
- `src/renderer/src/state/preview.ts`
- `src/renderer/src/shell/screens.ts` (look name and chroma per screen),
  `Workspace.tsx`, `Workspace.module.css`, `Workspace.test.tsx`

## Checks run

`npm run verify` on commit `9f5feb2` (base `main` f8dc565) passed all five steps
in 160.4 s: `typecheck`, `lint`, `format:check`, `test:coverage`, and `build`.

### Running app (port 5187)

At 1920x1080: the three previews drew the live 장 together after a click on a
tile, the 방송 자막 frame was green, a click on a small preview made it large
(its caption showed 무대 화면, 모니터 3, and 현재와 다음), and all names were
dim because no output is on. A screenshot showed the panel at its content height
with the 지우기 row and the 진행 도구 under it.

Not checked: the narrow window form in the app, a real background video in the
previews (three decoders; output plans a `preview` mode), and the amber outline
(no output status reaches the control window yet).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Checks run")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the live subscription is removed and
      the renderer is disposed on unmount)
- [x] Caches and lists have size caps (three previews)
- [x] An exception in the output path doesn't stop the output (a drawing error
      is logged, and the renderer keeps the last picture)
- [x] Only what's needed re-renders (a live change does not render React)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [ ] Measured performance values (not measured, see below)

## Decisions I made (for the lead to confirm)

- The screen list, targets, and look names come from the placeholders in
  `shell/screens.ts` (`TODO`), until the settings reach the control window.
- The 무대 화면 preview draws the same layers as the others. The stage layout
  needs a renderer that does not exist yet (`TODO` in `ScreenPreview.tsx`).
- Every preview draws at the renderer's own rate. The 미리보기 rate (30 fps) and
  a muted, lighter video mode are output's follow-up (`mode: 'preview'`).
- The shrink rule for a short window is built: the large preview keeps 16:9 and
  gets smaller, and the small previews are capped at 160 px wide so a wide
  column cannot make them tall (measured in "Team member's reply").

## Shared contract change requests

- None.

## Where to look

- `ScreenPreview.tsx`: the effect that creates, feeds, and disposes the
  renderer.
- `PreviewPanel.tsx`: which screen is large and the fixed order of the small
  ones.

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

Round 1 (codex2), answered once:

1. Finding 1 (short windows): the panel now follows the Layout shrink rule. The
   preview panel is as tall as its content and shrinks before anything else, the
   진행 도구 panel keeps at least 240 px (`--tools-min-height`), and inside the
   preview the large frame keeps 16:9, takes the largest size that fits its box,
   and is centered (`width: min(100cqw, 100cqh * 16 / 9)` in a size container
   with a 16:9 box). The small previews have their own row that never shrinks,
   so both stay visible. CSS cannot be measured in jsdom, so I measured the
   running app with real layout (right column, CSS px):

   | Window    | Preview panel | 지우기 | 진행 도구 | Large frame       | Small frames |
   | --------- | ------------- | ------ | --------- | ----------------- | ------------ |
   | 1280x720  | 322           | 52     | **240**   | 252x142, centered | 64x36 rows   |
   | 1536x864  | 367           | 52     | 339       | 332x187, centered | 64x36 rows   |
   | 1920x1080 | 462           | 68     | 428       | 452x254, centered | 160x90       |
   | 2560x1440 | 507           | 68     | 743       | 532x299, centered | 160x90       |

   At 1280x720 the 진행 도구 is exactly 240 and the large frame is smaller than
   its natural size, which is the case the finding is about; the width over
   height of every large frame is 1.775 to 1.780 (16:9). The structural parts
   are unit tests: only the large frame gets the `fit` class, and it moves with
   a swap.

2. Finding 2 (a swap rebuilt a renderer): the three previews are always rendered
   in the same order and in the same place of the tree, and a swap only changes
   the role classes, the caption, and the small preview's button (a sibling over
   the frame). So no renderer is built or disposed and no frame element is
   replaced. Tests: "builds no renderer, disposes none, and draws nothing again
   on a swap", "keeps the element that holds each renderer, so a video is not
   reloaded", "keeps the three previews in the same order in the tree whichever
   is large", and "keeps drawing the live layers on every renderer after a
   swap".
3. Finding 3 (selection test): "does not follow the selection: a real selection
   change draws and builds nothing" now opens other items and moves the selected
   tile through the real show state, without outputting, and asserts the same
   renderer instances, no disposal, and exactly the same draw counts. A second
   test, "changes only when the live state changes", outputs a tile (a command
   goes out and nothing draws until the live state arrives), and then checks
   that every preview draws the new state.
4. Finding 4 (nit, chroma): the green is only on the frame and on the renderer's
   root background (`.chroma .screen > div`). `--output-black` is no longer
   overridden, so the lyric shadows and outlines stay black.
5. Finding 5 (nit): the comment on `state/preview.ts` is a `NOTE(0913vision)`.
6. Round 2 checks: `npm run verify` on commit `f79c0fb` ran its five steps at
   once. `typecheck`, `format:check`, `test:coverage`, and `build` passed.
   `lint` failed with `ENOENT` on a temporary
   `electron.vite.config.ts.<number>.mjs` file that the parallel `build` creates
   and deletes, so it is a race between two steps of the verify run, not a lint
   finding. `npm run lint` alone passed (exit 0) on the same commit. I rebased
   onto `main` 94780dc afterwards and `typecheck` passed again.

Round 2 (codex2), answered once:

1. Finding 1 (1600x720 with the right column at 720 px): reproduced in the
   running app. The small previews were width driven (341x192 each), so the
   panel's 290 px were used up and the large frame was 0x0 at 1600x720 (107x60
   at 1600x800). Fix: a small preview is at most 160 px wide
   (`--small-max-width` on the panel, `width: min(100%, var(--small-max-width))`
   on the slot), still 16:9 and still beside each other, and the narrow window's
   64 px rows are unchanged. The large frame keeps the rest of the height.
   Measured in the running app (right column 720 px, CSS px):

   | Window    | Preview panel | 진행 도구 | Large frame       | Small frames |
   | --------- | ------------- | --------- | ----------------- | ------------ |
   | 1600x720  | 290           | **240**   | 146x82, centered  | 160x90       |
   | 1600x800  | 370           | **240**   | 288x162, centered | 160x90       |
   | 1920x1080 | 597           | 293       | 692x389, centered | 160x90       |

   The ratios are 1.778 to 1.780 and both small previews are visible in every
   row. The four sizes of the first table were measured again after the change
   with the default column widths; the large frames are the same, and only the
   small frames and the heights of the panels moved (the table above is
   updated). A test, `PreviewPanel.layout.test.ts`, guards the three rules that
   make this work (the width cap on a small preview, the unchanged 64 px row
   form, and the shrinking 16:9 large frame), since jsdom cannot lay out.

2. Finding 2 (nit): the two lines about `--output-black` and the missing shrink
   rule are updated.
3. Round 3 checks: `npm run verify` on commit `63ff817` (base `main` 94780dc)
   passed all five steps in 201.2 s: `typecheck`, `lint`, `format:check`,
   `test:coverage`, and `build`.
