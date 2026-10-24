# Review request: `shell-14`

Review range: 94780dc...feat/shell/service-data

What to check: that 진행 shows the service from `window.llp.service` and no
longer an invented sample; that an older revision of the same service is
dropped; that the open item and selected tile survive a change only when they
still exist; that a failed read is logged and keeps what is shown; and that the
warning icon, tooltips, and read-only mark follow the row problems of
`ShowService`.

- Team member: `shell`
- Branch: `feat/shell/service-data`
- Base commit (`main`): `94780dc`
- Last commit: see the commit that adds this file
- Related brief: `docs/spec/` (the `ShowService` view model in `src/shared`)

## What changed and why

The 진행 workspace read an invented sample service. The data layer now serves
the open 예배 순서 as `ShowService` (`service:get`, `service:changed`).

- `state/show.ts`: the store starts empty. `applyService` shows a service or
  clears everything for `null`. It drops a revision older than the one shown for
  the same service id, and it keeps the open item and selected tile only when
  the item is still in the rows (the tile index is clamped to the new length).
  `startServiceSync` reads once, subscribes, logs a failed read through
  `window.llp.log`, and returns the unsubscribe function.
- `control/main.tsx`: starts the sync next to the live sync.
- `show/model.ts`: rows can have kind `unknown` and a `problem`.
- `ServiceOrderList.tsx`: a row with a problem gets a `warning` icon and a
  tooltip. Kind `unknown` uses the `filex` icon.
- `ReadOnlyMark.tsx`: a warning on the 예배 순서 panel while the service is
  read-only (the file comes from a newer app version).
- `show/sampleService.ts` moved to `show/testing/sampleService.ts` as a test
  fixture with `seedSampleService()`. Tests that relied on the old initial state
  now seed it in `beforeEach`.

The main process already serves `service:get` (`registerStore` is wired in
`src/main/index.ts`). I have not yet checked the list in the real app.

## Changed files

- `src/renderer/src/state/show.ts` and `service.test.ts` (new)
- `src/renderer/src/control/main.tsx`
- `src/renderer/src/show/model.ts`, `ServiceOrderList.tsx` and `.module.css`
- `src/renderer/src/show/ReadOnlyMark.tsx`, `.module.css`, `.test.tsx` (new)
- `src/renderer/src/shell/Workspace.tsx`
- `src/renderer/src/show/testing/sampleService.ts` (moved)
- Tests that seed the sample: `ShowPanels`, `SlidePanel`, `shortcuts`,
  `Workspace`, and `state/show`

## Checks run

See "Verify result" at the end of this file.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (see "Verify result")
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (the main
      process and `parseShowService` validate; the renderer takes typed data)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (`startServiceSync` returns its
      unsubscribe function, as `startLiveSync` does)
- [x] Caches and lists have size caps (the list is the service itself)
- [x] An exception in the output path doesn't stop the output (not touched)
- [x] Only what's needed re-renders (selectors per field)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [ ] Measured performance values (not measured)
- [ ] Checked in the real app (not yet)

## Decisions I made (for the lead to confirm)

- A service with another id is accepted whatever its revision, because a
  revision only orders changes of one service.
- `null` clears the rows, the open item, and the jump keys at once.
- The tooltips for the row problems are my wording; the design system has none
  yet.

## Shared contract change requests

- None.

## Where to look

- `state/show.ts`: `isStale` and `keptSelection`.
- `state/service.test.ts`: the push-before-read case.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Not reviewed yet.

## Verify result

`npm run verify` on commit `5639f32` (base `main` 94780dc) passed all five steps
in 174.5 s: `typecheck`, `lint`, `format:check`, `test:coverage`, and `build`.
