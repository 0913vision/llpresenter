# Review request: data-21

Shared changes: each `app.json` layout size class can store optional
`thumbnailScalePercent`. `LayoutChange` accepts that percentage beside legacy
`columns` during the transition. No new channel, preload method, or shell file
changes. This is the contract for shell-24, not its main/renderer integration.

- Team member: data
- Branch: `feat/data/thumbnail-scale`
- Stacked on: data-20, `feat/data/ui-zoom` at
  `8d13d7fac067e05a1a590077f1914a36b27b05c5`
- Stack base (`main`): `56619c66de5ac3e2197b9881f2b1fb63e3e8f74e`
- Last code commit: `2fe2d15`
- Incremental review range: `8d13d7f..feat/data/thumbnail-scale`
- Status: implementation ready; request awaits data-20 merge and verify-failure
  classification by the lead
- Task: M2 check 1 row 9, the continuous slide-size contract
- Spec: 10, "Thumbnail size (proposal)", 50% through 200%, whole percentages

## What changed and why

`appConfig.ts` adds `thumbnailScalePercent: v.exactOptional(positiveInteger)` to
every size class. Old layouts stay valid and keep their `columns`. An absent new
field remains absent in parsing and serialization: shell uses 100% rather than
interpreting an old column count as a percentage. Unknown layout fields remain
preserved.

As with saved column counts, positive whole values outside the active range
remain readable and unchanged on disk. Shell-24 clamps them to 50 through 200
when reading its state. The file schema rejects zero, negative, fractional, and
nonnumeric values. It does not reject a file just because a positive percentage
is outside the active UI range.

`COLUMN_LIMITS.thumbnailScalePercent` defines `{min: 50, max: 200}`.
`LayoutChange` validates new scale commands as integers in that range. Widths
still require both left and right values. A message must carry widths, scale,
legacy columns, or a combination. Unknown IPC fields are dropped as before.

The lead explicitly selected a compatible transition instead of removing
`LayoutChange.columns` in this request:

1. data-21 keeps legacy `columns` commands accepted and adds
   `thumbnailScalePercent` next to them. Either or both can be present.
2. Shell switches its main and renderer consumers in shell-24, built on top
   after this contract merges. Existing shell behavior remains functional in the
   meantime. The current main layout merger does not yet apply new scale fields,
   so this contract alone does not persist a new scale command.
3. After shell-24 merges, data removes `columns` from `LayoutChange` in a small
   follow-up. The persisted legacy `app.json` field remains preserved.

## Changed files

- `src/shared/schema/appConfig.ts` and its test: optional scale, old-file
  compatibility, unknown-field preservation, and file round trips.
- `src/shared/schema/uiState.ts` and its test: percentage limits, strict new
  commands beside legacy commands, paired widths, and checked read replies.
- `src/shared/ipc.ts`: documents the compatible `setLayout` command.
- This review document. No shell, main-store, or preload implementation changes.

## Checks run

| Command or test                                                                      | Result                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `npm run typecheck`                                                                  | Passed after simplifying a mixed tuple test table            |
| Schema, app-config store, preload, main UI-state, and existing renderer-column tests | Passed: 7 files, 124 tests                                   |
| ESLint on changed TypeScript files                                                   | Passed                                                       |
| `npm run format`                                                                     | Passed before the code commit                                |
| `npm run verify`                                                                     | Run once: 4 of 5 steps passed; untouched cleanup test failed |

Tests cover all size classes and command combinations; 50, 200, and an
intermediate 123%; strict invalid command ranges and types; unchanged old
layouts; positive stored out-of-range values; invalid stored values; and unknown
fields. Existing main and renderer tests confirm legacy column commands remain
usable. Local logs use `.llp/data21-*.log`; the verify log is
`.llp/verify-data21-codex.log`.

### Single full verify result

Typecheck passed in 16.8 s, lint in 103.0 s, format check in 31.3 s, and build
in 4.8 s. Coverage finished in 203.0 s with 210 files passed and one failed:
2,378 tests passed, one was skipped, and one failed. The failure is
`scripts/verify/step-process.test.ts`, "lets go of a tree when the kill fails,
and says a process kept running". Its test cleanup at `test/process-trees.ts:79`
reported:

```text
could not end process 5344: taskkill did not finish within 5 s (SIGTERM)
```

No script, process cleanup, test configuration, shell, or native fixture source
changes in data-21. All changed-contract tests and the inherited Electron zoom
regression passed. This appears to be a cleanup timeout under load, but the
exact failure has not been classified as a known exception by the lead. The
review gate remains open for that classification. The full verify and failed
test were not rerun. After the run, PID 5344 and its direct children were no
longer present, so no further termination was needed.

The stack remains on data-20's reviewed head while its round 2 is pending. Per
the stacked-branch workflow, move this branch onto main after data-20 merges;
the incremental range above excludes the lower request.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes.
- [x] `npm run format:check` passes in verify.
- [x] New schema behavior has unit tests, including old-file compatibility.
- [x] External file and IPC values pass schemas; validation remains in the
      schema layer.
- [x] No `any`, unchecked assertions, or non-null assertions.
- [x] No subscriptions, timers, caches, output-path changes, or render work.
- [x] The change is limited to data's shared contracts and their tests.
- [x] Existing legacy consumers remain compatible during the transition.

## Decisions I made (for the lead to confirm)

1. Stored layout values follow the existing permissive positive-integer
   contract; shell applies limits on read. Commands enforce the active limits.
2. The transition follows the lead's explicit answer: retain command `columns`
   until shell-24 merges, then remove it in a separate data follow-up.

## Where to look

- `appConfig.test.ts`: new scale round trips, old files, and stored values that
  need shell clamping rather than making the file unreadable.
- `uiState.test.ts`: strict command validation and legacy/new combinations.

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
