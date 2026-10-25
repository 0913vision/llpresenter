# Review request: `shell-14`

Review range: ccbf48a...feat/shell/service-data

What to check: that 진행 shows the service from `window.llp.service` and no
longer an invented sample; that an older revision of the same service is
dropped; that the open item and selected tile survive a change only when they
still exist; that a failed read is logged and keeps what is shown; and that the
warning icon, tooltips, and read-only mark follow the row problems of
`ShowService`.

- Team member: `shell`
- Branch: `feat/shell/service-data`
- Base commit (`main`): `ccbf48a`
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

## Team member's reply

Round 1 (codex2), answered once:

1. Finding 1 (late first read): `startServiceSync` drops the first read when any
   push already arrived (`pushed`), whatever the ids or nulls are, because a
   push is always newer than a read that was asked earlier. The revision rule
   stays for pushes of the same service. Tests
   (`a read that is slower than a push`): another service, a push of none, a
   read of none after a push, and the read that is shown when no push came.
2. Finding 2 (preload turns a failed read into null): with finding 1 a failed
   first read can no longer clear a view, because a view can only exist at that
   moment from a push, and the read is dropped then. A failed read with no push
   leaves the list empty, which is right when nothing is known. The preload
   already logs it. To tell "no service is open" from "the read failed", the
   preload would have to reject; that is a change in `src/preload`, so I sent
   data the exact shape (`service.get()` logs and then rejects on a failed call
   or a bad reply, and keeps `null` for none open). The renderer already logs a
   rejection and keeps what is shown (test: "logs a failed read and keeps what
   is shown"), so it needs no change when data lands that. I can't test the real
   preload path from the renderer, so that test belongs to data's change.
3. Finding 3 (stopped sync): a `stopped` flag guards the push listener and the
   read. Tests (`after the sync was stopped`): a read that resolves later, a
   push that is still delivered, and a read that fails later (still logged,
   nothing changes).
4. Finding 4 (header): the open item stays only when its row is not a header.
   Tests: "closes the open item when its row became a header" and "keeps the
   open item when its row has a problem".
5. Finding 5 (nit): the TSDoc on the private `ShowView` fields is now a
   `NOTE(0913vision)` where the name doesn't say enough, and removed elsewhere.

## Verify result

`npm run verify` on commit `df3d2f1` (base `main` 8e0d3b3) passed all five steps
in 201.3 s: `typecheck`, `lint`, `format:check`, `test:coverage`, and `build`.

I rebased onto `main` ccbf48a afterwards (ui-4 and the shell-13 approvals);
`typecheck` passed again, and the rebase had no conflicts.

Round 2 (codex2), answered once:

1. The remaining finding (the preload turned a failed read into null): data
   landed the change as data-16, so every read of the preload (`live.get`,
   `ui.get`, `output.getStatus`, `service.get`) logs and rejects on a failed or
   malformed reply, and `service.get` still resolves a real null for "no 예배
   순서 is open". This branch is stacked on it. `startServiceSync` keeps what is
   shown when the read rejects (the preload has logged it, so the renderer no
   longer logs it a second time), and a real null still clears the view.
   `state/servicePreload.test.ts` runs the sync against the real preload with
   `electron` mocked: a rejected call and a malformed reply keep the view and
   log one error, a real null clears it, and a valid reply is shown.

Round 3 checks: I rebased onto `main` ccbf48a (data-16 and shell-15 are in it).
`npm run verify` on commit `4832e1e` passed all five steps in 225.4 s:
`typecheck`, `lint`, `format:check`, `test:coverage`, and `build`.
