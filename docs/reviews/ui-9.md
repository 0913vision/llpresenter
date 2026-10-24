# Review request: `ui-9`

- Team member: `ui`
- Branch: `fix/ui/listbox-modifiers`
- Review range: `1d46613...fix/ui/listbox-modifiers`
- Base commit (`main`): `1d46613`
- Last commit: the commit that adds this file (see the review request message)
- Related brief: `docs/briefs/ui.md`, M2 in `docs/MILESTONES.md`
- Shared changes: none
- What to check: that `ListBox` and `ListRow` leave every key with a modifier to
  the window, and the test that fails on the old code

## What changed and why

Shell found it while moving the 진행 workspace onto the ui parts of ui-4. With
the 예배 순서 list in focus, `ListBox` moved and cancelled ↑ ↓ Home End even
with Ctrl held, so Ctrl ↓ and Ctrl ↑ (다음 항목 and 이전 항목,
`docs/spec/10-shortcuts-and-settings.md`) moved the row instead, and shell's
handler, which returns on `defaultPrevented`, never saw them. `ListRow` did the
same with Enter and Space.

Now both leave a key with Ctrl, Alt, Shift, or the Windows key alone: no move,
no selection, no `preventDefault`. `TileList` already did this; the check moved
into `modifierKeys.ts` (`hasModifier`), which both lists use.

## Changed files

- `src/renderer/src/ui/modifierKeys.ts`: `hasModifier` and `ModifierState`.
- `src/renderer/src/ui/ListRow.tsx`: `ListBox` and `ListRow` pass modified keys
  on; the `ListBox` TSDoc says so.
- `src/renderer/src/ui/TileList.tsx`: uses the shared `hasModifier`; its TSDoc
  names the Windows key too.
- `src/renderer/src/ui/ListRow.test.tsx`: the test below.

## Checks run

| Command or test                          | Result                                                                                                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                         | Pass, 5 steps run at once, 227 s, on `3329f81`; after the rebase onto `1d46613` (output's renderer changes only) `npm run typecheck` and the ui and render tests pass again |
| `npx vitest run --project renderer` (ui) | Pass, 38 files, 346 tests                                                                                                                                                   |

The new test fails on the old code: in the 진행 list, ↑ ↓ End Home and Enter
with Control, Alt, Shift, or Meta held select nothing and are not cancelled, and
a plain ↓ still moves to the next row.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema (none here)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered listener is released (none added)
- [x] Caches and lists have size caps (none here)
- [x] An exception in the output path doesn't stop the output (not in the output
      path)
- [x] Only what's needed re-renders (no render change)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md` (TSDoc on exported APIs only)
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused per commit

## Decisions I made (for the lead to confirm)

1. **Shift passes on too**, as in `TileList`: the lists have no Shift ranges
   (one row is selected at a time), so a Shift key is always a window shortcut.

## Shared contract change requests

None.

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
