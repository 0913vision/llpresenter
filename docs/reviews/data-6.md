# Review request: `data-6`

- Team member: `data`
- Branch: `feat/data/undo-and-columns`, stacked on `data-5` (`feat/data/ipc`)
- Base commit (`main`): `4aa7901`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`; the lead's request for `data-6`

Shared changes:

- `src/shared/live.ts`: `LiveState.canUndo`, and `canUndo: false` in
  `emptyLiveState()`.
- `src/shared/schema/liveState.ts`: the reply schema requires `canUndo`.
- `src/shared/schema/uiState.ts`: `LayoutChange.columns` and
  `COLUMN_LIMITS.columns`.
- `src/shared/schema/fileFormat.ts`: comments only.

## What changed and why

Two shared contracts that shell asked for, and the two nits left from `data-1`
round 4.

1. `LiveState.canUndo` (required boolean). Shell dims the 되돌림 button when
   it's `false`. Output agreed on a required field: its reducer builds states by
   spreading the previous state, so it keeps compiling and `canUndo` stays
   `false` until output sets it in the reducer after this merges. No code on
   `main` builds a `LiveState` from a literal outside `src/shared`.
2. `LayoutChange.columns`: the thumbnail column count of a size class, saved in
   `app.json` `layout.<size class>.columns`. Shell chose this shape:
   `{sizeClass, left?, right?, columns?}`.
   - The drag end sends `left` and `right` together. The slider sends `columns`
     alone. Main merges field by field and keeps the others.
   - The schema requires `left` and `right` as a pair and at least one of the
     two groups. Every present value is an integer in `COLUMN_LIMITS`, which
     gains `columns: {min: 2, max: 8}`.
3. `data-1` nits:
   - The private helpers `checkTopLevel` and `checkEscaped` in `fileFormat.ts`
     have NOTE comments instead of TSDoc.
   - A new test shows that a schema callback that throws gives a `FileError`
     from both `parseFile` and `serializeFile`.

## Changed files

- See "Shared changes", and the tests: `liveState.test.ts`, `uiState.test.ts`,
  and `fileFormat.test.ts`.
- `docs/reviews/data-6.md` (new).

## Checks run

`npm run verify` on the commit before this document, on `main` 4aa7901 with
`data-5` below it: every step passed. The one skipped test belongs to another
member's suite.

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                                |
| `npm test`                         | Passed: 64 files, 644 tests and 1 skipped                             |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (165.7 s) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: none are registered.
- [x] Caches and lists have size caps: none are kept.
- [x] An exception in the output path doesn't stop the output: no output code
      changed.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not relevant.

## Decisions I made (for the lead to confirm)

1. `canUndo` is required, not optional like `startedAt`, because no code outside
   `src/shared` builds a `LiveState` from a literal. Output agreed.
2. The `LayoutChange` shape is shell's choice B. Requiring `left` and `right` as
   a pair keeps a half-written width pair from reaching `app.json`.

## Shared contract change requests

- None beyond this request.

## Where to look

- `src/shared/schema/uiState.ts`: the two checks on `LayoutChange`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (d5ad9bf, restacked by the member as b62f5ea with no change): reviewer
  (Codex, codex3) Approve with one nit: `src/shared/ipc.ts:45` `setLayout`'s
  TSDoc mentions only width changes; the member fixed it in data-4. Lead
  Approve. output sets `canUndo` in the live reducer next, and shell saves the
  thumbnail column count with `LayoutChange.columns`. Merged onto `main` 54c60fa
  without conflicts.

## Team member's reply

1.
