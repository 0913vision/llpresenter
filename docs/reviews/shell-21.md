# Review request: `shell-21`

Review range: 0f5b01c...fix/shell/no-clear-undo-key

What to check: that Ctrl Z no longer undoes a clear anywhere, that F1 to F7
still clear as before, and that the 되돌리기 button still undoes a clear and
shows no shortcut.

- Team member: `shell`
- Branch: `fix/shell/no-clear-undo-key`
- Base commit (`main`): `0f5b01c`
- Last commit: see the commit that adds this file
- Related brief: row 8 of `docs/plans/m2-check1-feedback.md`

## What changed and why

Row 8 removes the Ctrl Z binding for undoing a clear. The 되돌리기 button stays
until it becomes a setting (row 7, spec-13).

- `show/clearKeys.ts`: the Ctrl Z branch is gone, with what only it used: the
  undo key check, the workspace set, and the text entry check. `handleClearKey`
  and `useClearKeys` no longer take the workspace, because the clear keys work
  the same in every workspace. The listener is `handleClearKey` itself, so the
  effect runs once.
- `show/clear.ts`: `UNDO_SHORTCUT` is gone.
- `show/ClearRow.tsx`: the 되돌리기 tooltip shows the name only, and the button
  has no `aria-keyshortcuts`.
- `control/App.tsx`: `useClearKeys()`.

## Changed files

- `src/renderer/src/show/clearKeys.ts`, `clearKeys.test.ts`
- `src/renderer/src/show/clear.ts`
- `src/renderer/src/show/ClearRow.tsx`, `ClearRow.test.tsx`
- `src/renderer/src/control/App.tsx`, `App.test.tsx`

## Checks run

See "Verify result" at the end of this file. The new App test "clears with F2 in
진행 but never undoes a clear with Ctrl Z" fails on the code before this change
(it sends `clear.undo`).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Verify result")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (not touched)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the keydown listener is removed on
      unmount, tested)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (not touched)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not applicable)

## Decisions I made (for the lead to confirm)

- Ctrl Z now passes through untouched in 진행. Nothing else in 진행 binds it, so
  it does nothing there; in 준비 it stays the edit undo of the fields.
- Not mine: ui's `ClearButton` part still gives its undo button `Ctrl Z`
  (`UNDO_SHORTCUT` in `ui/ClearButton.tsx`). The 지우기 row doesn't use that
  part yet.

## Shared contract change requests

- None. `clear.undo` stays: the button sends it.

## Where to look

- `clearKeys.ts`: `handleClearKey`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (3b11278): reviewer (Codex, codex2) Approve with no findings. Lead
  Approve; Ctrl Z no longer undoes a clear in 진행 (user feedback row 8: no
  ProPresenter source undoes a clear), and the 되돌리기 button keeps working
  without a shortcut in its tooltip. Fast-forward merge.

## Verify result

`npm run verify` on commit `a466c3c` (base `main` 0f5b01c): all five steps
passed in 138.8 s.
