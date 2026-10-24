# Review request: `data-11`

Review range: `6559a9b...feat/data/service-channel`

Round 2 changes only: `84f2d01...feat/data/service-channel`

- Team member: `data`
- Branch: `feat/data/service-channel`, on `main` (data-8 has merged)
- Base commit (`main`): `6559a9b` (round 1: `814781b` with data-7 and data-8
  below)
- Last commit: see the newest commit that changes this file
- Related brief: `docs/briefs/data.md`; M2 in `docs/MILESTONES.md`,
  "Main-process file store"

What to check in round 2:

1.  Round 1 had no findings. Round 2 follows `data-8` round 2, where `loadStore`
    returns a `Result` and refuses a data folder that a junction or link leads
    outside `LLP_USER_DATA`. `registerStore` (`src/main/store/register.ts`) now
    logs that error and answers `null`. Test: `register.test.ts`, "logs a data
    folder that a junction leads outside and answers null".
2.  The rebase onto `main` with `data-8` round 2 changed one other thing in this
    branch: the preload test's sample `ShowService` gains `readOnly`, which the
    contract now requires. `buildShowService` now takes each file's
    `LoadedFile`, so a read-only song or 예배 순서 reaches 진행 as
    `newer-version` or `readOnly`.

What to check in round 1:

1.  `src/shared/ipc.ts`: the `service` part of `LlpApi` against shell's shape
    under "Shared changes" below.
2.  `src/preload/index.ts`: every reply and push goes through
    `parseShowService`; a bad one is logged and gives `null` or is dropped; the
    unsubscribe removes the listener.
3.  `src/main/store/register.ts`: `service:get` waits for the data at launch,
    never rejects, and answers `null` on any failure; the handler is removed on
    dispose; the logged problems are capped.
4.  `LLP_USER_DATA`: `electronStoreContext` keeps a development run inside it.

## Shared changes

All in data's paths:

1.  `src/shared/ipc.ts`: new channels `service:get` (invoke, answers
    `ShowService | null`) and `service:changed` (push, `ShowService | null`).
    `LlpApi.service` has `get()` and `subscribe(listener)`, which returns an
    `Unsubscribe`, in the shape shell asked for.
2.  `src/preload/index.ts`: `service.get` and `service.subscribe` check every
    reply and push with `parseShowService`. A malformed reply, or a failed call,
    is logged and gives `null`. A malformed push is logged and dropped. `listen`
    now takes the parser, so the live state and the service share it.
3.  `src/shared/testing/fakeLlpApi.ts`: `service.get` answers `null`, and
    `service.subscribe` does nothing.

## What changed and why

The last of the M2 file store requests before the backups. `registerStore`
(`src/main/store/register.ts`) reads the data at launch with `loadStore` from
`data-8`, and answers `service:get` with the open 예배 순서 built by
`buildShowService`:

- A window that asks before the data is read waits for it, so 진행 never shows
  an empty list by mistake.
- No 예배 순서 at all answers `null`.
- The first answer has revision 1. Row ids are the item ids, and a tile's
  position is its index in the 구성, so the live state keeps pointing at the
  same item and tile.
- Every launch logs one line with the data folder, the counts, and the open 예배
  순서.
- A broken `app.json` logs one warning that the app never writes over it.
- Every skipped file, or dropped part of one, is logged as a warning, up to 50.
  More than that logs one line with the count, so a folder of broken files can't
  flood the log.
- Anything that throws while finding or reading the data is logged, and the
  answer is `null`. `registerStore` itself never throws.

The main process doesn't push `service:changed` yet, because nothing changes the
open 예배 순서 after launch. A TODO in `register.ts` marks where editing will
push the next revision. The channel and the preload side are ready for it, so
shell can subscribe now.

`electronStoreContext` reads the app data folder and Documents from Electron,
and `LLP_USER_DATA` from the environment. With `LLP_USER_DATA` set, every data
folder stays inside it (`data-7`).

### Wiring (output)

`src/main/index.ts` is output's. After this merges, output adds one call next to
`registerIpc` in `start()`, and calls its result where `disposeIpc()` runs:

```ts
const disposeStore = registerStore(log);
```

## Changed files

- `src/shared/ipc.ts`, `src/shared/testing/fakeLlpApi.ts` and its test.
- `src/preload/index.ts` and its test.
- `src/main/store/register.ts` and its test (new).
- `docs/reviews/data-11.md` (new).

## Checks run

Round 2: `npm run verify` on the commit before this document's round 2 change
(dc679c3), on `main` 6559a9b: every step passed. The one skipped test belongs to
another member's suite. Coverage: `src/main/store/` 98.4% of lines and 93.3% of
branches, `src/preload/` 94.1% of lines and 90% of branches.

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                                |
| `npm test`                         | Passed: 129 files, 1411 tests and 1 skipped                           |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (234.0 s) |

The first round 2 run, before dc679c3, failed two preload tests: their sample
`ShowService` had no `readOnly`, which `data-8` round 2 made required. dc679c3
adds it. Round 1 passed on `main` 814781b with `data-7` and `data-8` below it
(1133 tests, 279.7 s).

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema: the preload
      checks every `service:get` reply and `service:changed` push, and every
      file goes through its parser.
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: `registerStore` returns a function
      that removes its handler, and `subscribe` returns one that removes the
      listener. Tests check both.
- [x] Caches and lists have size caps: at most 50 problems are logged one by
      one.
- [x] An exception in the output path doesn't stop the output: nothing here runs
      in the output path, and a failure to read the data answers `null`.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured. The data is
      read once, at launch, off the output path.

## Decisions I made (for the lead to confirm)

1.  `service:get` waits for the data at launch instead of answering `null` first
    and pushing later. It saves shell a second code path for the first answer.
2.  The data is read as soon as `registerStore` runs, in parallel with the
    control window opening.
3.  Problems go to the log only. The notifications for skipped files and the
    `app.json` warning need a notification channel, which doesn't exist yet.
    `LoadedStore.problems` holds everything they need.

## Where to look

- `src/main/store/register.ts`: the waiting answer and the log cap.
- `src/preload/index.ts`: `listen` with a parser.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (8a7de95): reviewer (Codex, codex3) Approve, no findings.
- Round 2 (df6ff6c): after data-8 made loadStore fail closed, registerStore logs
  a refused data folder and answers null. Reviewer (Codex, codex3) Approve, no
  findings. Lead Approve. output adds the one-line registerStore call in
  `src/main/index.ts`. Rebased by the lead onto local `main` without conflicts.

## Team member's reply

Round 1 had no findings (codex3, Approve). Round 2 adapts `registerStore` to
`data-8` round 2: `loadStore` returns a `Result` now, and a refused data folder
logs `refused the data folder` with the problem and answers `null`, without
reading any data. The preload test's sample `ShowService` gains `readOnly`, the
field `data-8` round 2 added to the contract.
