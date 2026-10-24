# Review request: `shell-15`

Review range: 6d8332f...fix/shell/preview-click

What to check: that a click on the picture of a small preview reaches the button
that makes it large, that the large preview and the live picture are not
changed, and that the CSS test guards the rules that make the click work.

- Team member: `shell`
- Branch: `fix/shell/preview-click`
- Base commit (`main`): `6d8332f`
- Last commit: see the commit that adds this file
- Related brief: bug M2-3 of qa (a click on a small preview's picture does
  nothing)

## What changed and why

The button that makes a small preview large is a sibling laid over the frame.
The output renderer gives each of its layers `z-index: 1`, and the renderer root
is not a stacking context, so the layers painted above the button and took the
click. `document.elementFromPoint` on the picture returned the renderer's
`_page_` element, as qa found.

- `.slot` is a stacking context of its own (`isolation: isolate`), so nothing in
  the renderer can rise above the button, and it has `pointer-events: none`, so
  a click on the picture never lands on the renderer.
- `.hit` has `z-index: var(--z-preview-hit)` (1, declared on the panel).

jsdom has no layout and no hit testing, so the unit test reads the CSS rules.
The real check ran in the running app (below).

## Changed files

- `src/renderer/src/show/PreviewPanel.module.css`
- `src/renderer/src/show/PreviewPanel.layout.test.ts`

## Checks run

Real app (dev build of this branch, 1920x1080, real CDP mouse events): before
the change `document.elementFromPoint` at the center of the small 무대 화면
frame gave `DIV._page_` and the click left 본 화면 large. After the change it
gives the `미리보기 크게 보기` button, and the same click makes 무대 화면 large.

See "Verify result" at the end of this file for `npm run verify`.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Verify result")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests (a CSS rule test and
      the real app check, since jsdom can't hit test)
- [x] Values from outside the process are validated with a schema (not touched)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (not touched)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (CSS only)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- None.

## Shared contract change requests

- None.

## Where to look

- `PreviewPanel.module.css`: the `.slot` and `.hit` rules.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Not reviewed yet.

## Verify result

`npm run verify` on commit `88defc7` (base `main` 6d8332f): `typecheck`, `lint`,
`format:check`, and `build` passed. `test:coverage` had one failure in a test I
did not touch: `scripts/soak/media.test.ts` > "ends the stalled maker and every
process it started" (`expected true to be false`), which is a known failure on
`main` since devops-13 (devops fixes it as devops-17). The file passes alone on
the same commit (11 of 11 tests). All other tests passed.
