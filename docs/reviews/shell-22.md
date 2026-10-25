# Review request: `shell-22`

Review range: e2d4c75...fix/shell/slide-term

What to check: that every user-visible 장 in shell's files that means a slide
now says 슬라이드, and that nothing else changed.

- Team member: `shell`
- Branch: `fix/shell/slide-term`
- Base commit (`main`): `e2d4c75`
- Last commit: see the commit that adds this file
- Related brief: row 2 of `docs/plans/m2-check1-feedback.md`

## What changed and why

Row 2 renames the term 장 to 슬라이드 (user decision). In shell's files, 장
reached the screen in three places:

- `shell/Workspace.tsx`: the panel title of the 진행 slide panel, "장" becomes
  "슬라이드" (the tab reads "슬라이드 | 미디어").
- `show/SlideGrid.tsx`: the accessible name of the grid.
- `show/SlidePanel.tsx`: the count in the panel header while the open item is
  not live, "4장" becomes "슬라이드 4개". The live position "2 / 4" stays.

## Changed files

- `src/renderer/src/shell/Workspace.tsx`, `Workspace.test.tsx`
- `src/renderer/src/show/SlideGrid.tsx`, `SlidePanel.tsx`,
  `SlidePanel.test.tsx`, `ShowPanels.test.tsx`

## Checks run

See "Verify result" at the end of this file. The new Workspace test "names the
slide panel of the 진행 workspace 슬라이드" and the three count tests fail on
the code before this change.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Verify result")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (not touched)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (not touched)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (not touched)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not applicable)

## Decisions I made (for the lead to confirm)

- The count reads "슬라이드 4개", in the count format of the design system
  README ("항목 12개"). "4슬라이드" isn't Korean, and a bare "4개" loses the
  unit. The design system's `ListRow` meta example "9장" belongs to ui's part of
  the rename.
- Only user-visible strings changed, as the batch says. English comments and
  test names in shell's files still use 장 as the glossary term; they follow
  once the glossary in the design system README changes.

## Shared contract change requests

- None.

## Where to look

- `SlidePanel.tsx`: `SlidePanelMeta`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Not reviewed yet.

## Verify result

`npm run verify` on commit `c937148` (base `main` e2d4c75): all five steps
passed in 164.4 s.
