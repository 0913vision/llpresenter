# Review request: `shell-12`

Review range: f8dc565...feat/shell/previews

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
- Base commit (`main`): `f8dc565`
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
   frame is chroma green when empty (the frame overrides `--output-black`, which
   the renderer root uses).
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

Pending.

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
- The shrink rule for a short window (the large preview keeps 16:9 and gets
  smaller) is not built: the panel clips. It needs the real heights of the
  column, which I will measure with the tools panel next.

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

1.
