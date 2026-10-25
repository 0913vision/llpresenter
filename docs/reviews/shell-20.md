# Review request: `shell-20`

Review range: 3e31e01...fix/shell/hide-look-names

What to check: that the previews no longer show the placeholder Look and stage
layout names, and still show each screen's name and target.

- Team member: `shell`
- Branch: `fix/shell/hide-look-names`
- Base commit (`main`): `3e31e01`
- Last commit: see the commit that adds this file
- Related brief: row 6 of `docs/plans/m2-check1-feedback.md`

## What changed and why

The large preview showed "기본", "현재와 다음", and "하단 자막" under the
screen. They were placeholders in `shell/screens.ts`, not real settings, and the
user read them as real. The decision (row 6) hides them until the screen
settings exist in M3.

- `shell/screens.ts`: `lookName` is gone from `ScreenSummary` and the three
  placeholder screens. The TODO says the name comes back with the screen
  settings, as the `look` of the ui `PreviewFrame` that the panel moves to.
- `show/PreviewPanel.tsx` and `PreviewPanel.module.css`: the caption of the
  large preview has no look name and no `.look` rule.

## Changed files

- `src/renderer/src/shell/screens.ts`
- `src/renderer/src/show/PreviewPanel.tsx`, `PreviewPanel.module.css`,
  `PreviewPanel.test.tsx`

## Checks run

See "Verify result" at the end of this file. The new test "writes no Look or
stage layout name until the screen settings exist" fails on the code before this
change.

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

- The field is removed rather than left empty, so no code path waits for data
  that doesn't exist yet. The ui `PreviewFrame` already takes an optional
  `look`, so M3 adds it there.

## Shared contract change requests

- None.

## Where to look

- `PreviewPanel.tsx`: `LargeCaption`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (81da9e4): reviewer (Codex, codex2) Approve with no findings. Lead
  Approve; the previews no longer show the placeholder Look and stage layout
  names (user feedback row 6 of `docs/plans/m2-check1-feedback.md`); the screen
  names and targets stay. Fast-forward merge.

## Verify result

`npm run verify` on commit `1f63036` (base `main` 3e31e01): all five steps
passed in 155.6 s.
