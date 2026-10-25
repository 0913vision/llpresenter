# Review request: `shell-23`

Review range: 3073f48...test/shell/show-focus-outline

What to check: that the 진행 예배 순서 list and slide grid carry the 진행 marker
of ui-12, so their keyboard focus outline is hidden in 진행 only, and that the
tests fail without it.

- Team member: `shell`
- Branch: `test/shell/show-focus-outline`
- Base commit (`main`): `3073f48`
- Last commit: see the commit that adds this file
- Related brief: row 3 of `docs/plans/m2-check1-feedback.md`, ui-12

## What changed and why

ui-12 hides the row and slide focus outline when the `ListBox` or
`ThumbnailGrid` gets `workspace="show"`, and keeps it in 준비 (the default). The
진행 `ServiceOrderList` and `SlideGrid` have passed `workspace="show"` since
shell-16, so no code change is needed. This request adds the two tests that pin
it: each checks `data-workspace="show"` on the listbox. Both fail when the prop
is removed.

The LIVE ring and the selection ring are ui's and unchanged. The 지우기 buttons
and the preview swap button keep their outline: they don't take focus on a click
(`CLICK_FOCUS_SELECTOR`), so the outline only shows when Tab reaches them.

준비 has no list or grid of shell's yet; its parts get the default, which draws
the outline.

## Changed files

- `src/renderer/src/show/ShowPanels.test.tsx`

## Checks run

See "Verify result" at the end of this file.

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

- The outline itself is CSS in ui's files and ui checked it in Chromium (ui-12),
  so these tests check the marker shell sets, not the drawn outline.

## Shared contract change requests

- None.

## Where to look

- `ShowPanels.test.tsx`: the two "is a 진행 ..." tests.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (d0165a0): reviewer (Codex, codex2) Approve with no findings. Lead
  Approve; 진행 already passed `workspace="show"` to the list and the slide
  grid, so ui-12 hides their focus outline there (user feedback row 3); this
  request adds two tests that fail without it. Fast-forward merge.

## Verify result

`npm run verify` on commit `296051c` (base `main` 3073f48): all five steps
passed in 101.5 s.
