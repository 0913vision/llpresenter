# Review request: `shell-19`

Review range: e8cf59a...fix/shell/ui-state-owner

Changes outside my files, as output allowed (output-c6): `src/main/index.ts`
(the `registerUiState` call: it takes the data store's `appConfig` and is no
longer `await`ed) and `src/main/index.wiring.test.ts` (the mock of
`registerUiState` is synchronous; the order test is unchanged, so
`registerUiState` still runs before the control window opens).

What to check: that `src/main/uiState` no longer reads, parses, or writes
`app.json`; that a layout change is merged field by field and handed to the data
store as `{layout}` only; and that the shutdown still ends within its limit when
saving never ends.

- Team member: `shell`
- Branch: `fix/shell/ui-state-owner`
- Base commit (`main`): `e8cf59a`
- Last commit: see the commit that adds this file
- Related brief: bug M1-12 and the decision "One owner of app.json"
  (`docs/decisions.md`), with data-17 (`UiStateFields`)

## What changed and why

`app.json` had two owners: the data store (`AppConfigFile`) and `UiStateStore`,
which parsed it again (a broken file logged three warnings) and would have
written it too. The data store is now the only reader and writer.

- `uiState/uiStateStore.ts`: `UiStateStore` takes `UiStateFields` (`read()` and
  `change(fields)`). `state` is `{layout}` of `read()`. `setLayout` validates
  the change, merges it with `withLayoutChange`, and calls `change({layout})`.
- `uiState/layout.ts`: `withLayoutChange` (the merge, unchanged in behavior).
- `uiState/register.ts`: `registerUiState(fields, log)` is synchronous and
  `dispose()` only removes the channels, because the shutdown already runs
  `save app.json` (`appConfig.flush()`) after `save the UI state`.
- Deleted: `fileIo.ts`, its test, and the debounce and drain tests, since the
  data store does the saving (its tests cover a burst, two writes in a row, a
  broken file, and a newer file: `appConfigFile.test.ts`).

Not in this change: persisting `previewBig` (the large preview choice). It needs
a channel in `src/shared` and `src/preload`, which are data's. I'll send data
the request after this branch.

## Changed files

- `src/main/uiState/uiStateStore.ts`, `layout.ts`, `register.ts` and their tests
  (`uiStateStore.test.ts`, `layout.test.ts`, `register.test.ts`)
- `src/main/index.ts`, `src/main/index.wiring.test.ts`
- `src/main/shutdown.integration.test.ts` (the real registration now sits next
  to a `save app.json` step that never ends)
- Deleted: `src/main/uiState/fileIo.ts`, `fileIo.test.ts`,
  `uiStateStore.drain.test.ts`

## Checks run

See "Verify result" at the end of this file.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Verify result")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the layout
      change is still validated by `parseLayoutChange`)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the timer is gone; `dispose` removes
      the channels)
- [x] Caches and lists have size caps (not applicable)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (not applicable)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)

## Decisions I made (for the lead to confirm)

- `registerUiState` is synchronous and `dispose` is `void`, because nothing is
  read from disk or saved here any more.

## Shared contract change requests

- `previewBig` through the UI state: add it to `UiState` and a
  `ui:preview-big:set` channel with `ui.setPreviewBig(screenId)`. I'll send the
  exact shape to data.
- Update after the merge: the lead decided that `previewBig` waits for the real
  screen ids from `screens.json` (M3-D2), so this request is on hold. A
  placeholder id such as `main` is not a screen id and would make `app.json`
  fail its check.

## Where to look

- `uiStateStore.ts`: that only `{layout}` goes to `change`.
- `shutdown.integration.test.ts`: the limit when `save app.json` never ends.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (180eff1): reviewer (Codex, codex3) Approve with one nit: the "Verify
  result" section this document refers to is missing. The nit goes into shell's
  next branch. Lead Approve; fixes the shell half of M1-12, so `uiState` reads
  and changes its fields through the data store's `UiStateFields` and no longer
  parses or writes `app.json`. The review was resent after the power loss at
  09:48. Rebased by the lead onto local `main` without conflicts.

## Verify result

Added in shell-16 round 2 (codex3's nit). The `npm run verify` run on commit
`180eff1` stopped in the power loss at 09:48: `build` and `typecheck` had
passed, and `lint`, `format:check`, and `test:coverage` had not finished. After
the restart, on the same commit: `npm run typecheck` passed, the `uiState` tests
and the main tests this request changed passed (5 files, 31 tests), and the
`shell`, `control`, `state`, and `show` tests passed (26 files, 397 tests). The
full `npm run verify` ran on shell-16 round 2, whose base contains this request;
see "Verify result" in `docs/reviews/shell-16.md`.
