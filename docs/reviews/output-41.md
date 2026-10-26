# Review request: `output-41`

- Team member: `output`
- Branch: `feat/output/stage-layer`
- Base and range: in the review request message (rebased onto `main` after
  output-40's merge).
- Scope: M3-O5b, the 무대 화면's stage layout on the output and its previews:
  current and next lyrics, current and next 이름표, the clock, the stage 타이머,
  and the stage message, with auto-fit. This closes M3-O5 except 그림 and 메모
  for 장 elements, whose sources don't reach the renderer yet (spec 03 has both
  as proposals and an open question).
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## What changed and why

- `ScreenFrames` follows `stage-layouts.json` too. For a 무대 화면 it resolves
  the layout chosen for this output (`stageLayouts`, output-40), else the Look
  card's `stageLayout`, and puts it in `RenderFrame.stage` with the stage
  타이머. An audience screen never gets one. A layout id that no longer exists
  is logged once as a Look gap (`missing-layout`) and the screen draws as
  before. `resolveScreenLook` passes a 무대 화면 card's `stageLayout` on.
- `StageLayoutView` (`render/stageLayout.ts`, new) and its layer
  (`layers/stage.ts`, order 3: above 소품, below 메시지):
  - The canvas keeps the layout's size and scales as a whole, centred, to fit
    the screen; frames are canvas px and text sizes are px on a 1080-line
    canvas, as for lyric styles. The picture correction applies to the layer box
    like every other layer.
  - The elements are built once per layout object, and after that only their
    text is written, and only when it changes. 크기 자동 맞춤 shrinks the font
    with `fitFontSize`, the same search the 장 uses.
  - Content: the live 장's lines and 이름표, `next` from output-40 (empty after
    the last 장), the stage message, the clock as "HH:MM", and the stage 타이머
    through output-35's `fillTimerTokens`, so it reads exactly as a 소품 token
    does. The Look card's switches empty the 장 and 이름표 elements (lyrics
    off), the clock, and the stage message; the 타이머 has no switch.
  - One interval redraws only the clock and a running 타이머 while one shows,
    and is released when none does and on dispose. A failing tick keeps the text
    and logs once per message, up to 32, as output-35's ticker does.
- With a stage layout, the lyrics layer and the stage message layer step aside
  on that screen (a NOTE), so nothing draws twice. Without one, a 무대 화면
  draws as before.
- `fontFamilyFor` is exported from `slideLayer.ts` so stage text uses the same
  font fallback.
- The lead's output-40 nit: `SlideLayer`'s TSDoc is back above `SlideLayer` in
  `src/shared/live.ts`.
- Spec 03: the canvas scaling, the text size unit, the clock format, and the
  fallbacks (proposal).

## Changed files

- `src/renderer/src/render/stageLayout.ts`, `stageLayout.module.css`,
  `layers/stage.ts` (new) and `stageLayout.test.ts` (new).
- `src/renderer/src/render/layer.ts`, `screenLook.ts`, `screenFrames.ts`,
  `slideLayer.ts`, `layers/lyrics.ts`, `layers/stageMessage.ts`, and the tests
  of the frames, the Look, the output entry, and the preview overlays (the
  settings feed count is four now).
- `src/shared/live.ts` (TSDoc placement only).
- `docs/spec/03-output.md`.

## Changes outside my paths

None beyond moving a TSDoc in `src/shared/live.ts` back to its declaration.

## Checks run

| Command or test                                              | Result                                   |
| ------------------------------------------------------------ | ---------------------------------------- |
| `npm run typecheck`                                          | Pass                                     |
| `npx vitest run src/renderer src/main/live src/shared`       | Pass, 3453 tests                         |
| `npx eslint` and `npx prettier --check` on the changed files | Pass                                     |
| Mutation checks (`.llp/output-41/mutations.log`)             | 22 mutations, all fail a test            |
| `npm run verify`                                             | GitHub CI only (see the request message) |

Six mutations survived a first run and fail since the tests that pin them (the
log shows both runs): a write of unchanged text, the text size on a canvas of
another height, a lone clock ticking, a tick redrawing more than the clock and
타이머, and a stage layout reaching an audience screen through the frames or the
Look. One NO-MATCH line was a typo in the mutation command, run again as the
next-lines mutation.

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

1. The canvas scales uniformly and centred (letterboxed) rather than stretching
   to the screen.
2. The stage layout layer sits at order 3, so 메시지 still shows above it on a
   무대 화면 when the Look turns 메시지 on.
3. A 무대 화면 without a usable layout draws the 장 and the stage message as it
   did before stage layouts.
4. 그림 and 메모 장 elements draw nothing until their sources exist (a TODO).

## Shared contract change requests

None.

## Where to look

- `render/stageLayout.ts`: `contentOf`, `StageLayoutView.render`, `ticks`.
- `render/screenFrames.ts`: `stageFrame`.
- `layers/lyrics.ts`, `layers/stageMessage.ts`: the handoff.

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
