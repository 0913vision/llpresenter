# Review request: `data-46`

- Team member: data (Claude session)
- Branch: `feat/data/macro-drop`, stacked on data-48
  (`feat/data/saving-dialog`), which is stacked on data-44
- Base commit: the data-48 head; the request message gives the range, the head
  commit, and its CI run.
- Related brief: `docs/briefs/data.md`; request from `.llp/task.md`, "Next (from
  the lead, 10:15)", item 1, following spec-41 (spec 01 and 08 on
  `docs/spec/recovery-snapshot`).

## What changed and why

Spec 01 now says that a dropped dispatch is logged once, after the entries for
skipped actions, and that the entry carries the id of the 매크로 it ran. Spec 08
adds a warning card, 매크로 적용 실패, with that 매크로's name, and says that a
dropped dispatch without a 매크로 is only logged.

1. **App problem channel.** `app:problem`, `LlpApi.problems.subscribe`, and
   `AppProblem` in `src/shared/schema/appProblem.ts`, a union by `kind`. The
   shape was agreed with the 진행 member (visio-c9), who builds the card in
   spec-45 and adds the `file-skipped` and `save-failed` kinds to the same
   union, so the app keeps one problem channel. This request adds
   `{kind: 'macro-dropped', macroId, name}`. Preload checks every push and logs
   and drops a bad one. `name` is at most 200 UTF-16 units
   (`APP_PROBLEM_LIMITS.nameCharacters`); `macroDroppedProblem` cuts a longer
   name at a whole character.
2. **The 매크로 that ran.** `SliceContext.ranMacro` lets the 매크로 runner note
   each 매크로 it runs, for `macro.run` and for an `item.start` with a start
   매크로, with its name as compiled. The registry keeps these notes with the
   deferred effects in one `ReductionRecord`, so a skipped child drops its notes
   as it drops its effects, and both lists are bounded.
3. **The drop entry.** A dropped dispatch is now its own diagnostic,
   `reason: 'dropped'`, with the error and the 매크로 that ran, after the
   entries of the skipped children. `dispatchLogged` logs it as
   `dropped live dispatch` with `macroIds`; it was a `skipped live command` with
   `invalid-overlay` before, the same message as one skipped action.
4. **The problem.** After the diagnostics, `LiveStore` reports one
   `macro-dropped` problem per noted 매크로 to `subscribeProblems` listeners; a
   throwing listener goes to the dispatch's listener error handler and the
   others still run. A dropped dispatch without a 매크로 reports nothing.
   `src/main/problemFeed.ts` (round 2) sends each problem to every window and
   keeps it until a window next reads the list (below).
5. **Standing problems.** Files skipped at startup are reported before the
   control window loads, so a push alone would lose them (visio-c9).
   `LlpApi.problems.list()` (`app:problem:list`) reads the standing problems
   once, as `output.getStatus` does beside its push; the list is capped at
   `APP_PROBLEM_LIMITS.listed` (64). The problem feed lists its standing sources
   first (none yet: data-47 adds the waiting saves and spec-46 the skipped
   files, through `addStanding`), then the one-shot problems that no window has
   read yet.

## Changed files

- `src/shared/schema/appProblem.ts` and `.test.ts`: the payload, limit, parser,
  and builder.
- `src/shared/ipc.ts`, `src/preload/index.ts` and `.test.ts`,
  `src/shared/testing/fakeLlpApi.ts` and `.test.ts`: the channel and API.
- `src/main/live/slice.ts`: `RanMacro` and `SliceContext.ranMacro`.
- `src/main/live/sliceRegistry.ts` and `.test.ts`: `ReductionRecord`, the
  `dropped` diagnostic.
- `src/main/live/store.ts` and `.test.ts`: the drop log entry and
  `subscribeProblems`.
- `src/main/live/README.md`: the drop entry and the problem.
- `src/main/live/limits.test.ts`: the drop entries and one problem.
- `src/main/macros/runner.ts` and `.test.ts`: note the 매크로; dropped
  `macro.run` and `item.start` dispatches.
- `src/main/problemFeed.ts` and `.test.ts` (round 2): the app's problem feed,
  its list handler, and the live store's problems.
- `src/main/index.ts` and `index.wiring.test.ts` (round 2): register the feed
  and stop it on shutdown.
- `src/main/ipc.ts` and `.test.ts`: unchanged in the end (round 2 moved the push
  out again).
- `docs/reviews/data-46.md`: this request.

## Changes outside my paths

- `src/main/live/` (output): the drop is decided in the live registry and logged
  by `dispatchLogged`.
- `src/main/index.ts` and its wiring test (output): the feed's registration and
  disposal, following "File ownership" for new main-process modules.
- `src/main/macros/` (tools): only the runner knows which 매크로 ran and its
  name.

## Shared contract changes (additive)

- `app:problem`, `app:problem:list`, `LlpApi.problems.subscribe` and `list`,
  `AppProblem`, `APP_PROBLEM_LIMITS`, `parseAppProblem`, `parseAppProblems`,
  `macroDroppedProblem`. No existing contract changes.

## Checks run

| Command or test                                    | Result                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                                | Pass                                       |
| Vitest (`--no-fsModuleCache`) on the changed areas | Pass                                       |
| `npx eslint` on the changed files                  | Pass                                       |
| `npm run format:check`                             | Pass                                       |
| `npm run verify`                                   | GitHub CI on the head commit (see request) |

Tests: valid, unknown-field, limit, and invalid payloads, and cutting a name of
surrogate pairs; preload's check and removal; two 매크로 in one dropped batch
are reported in order after the log entry, while a skipped child's note is not;
a throwing problem listener; no problem without a 매크로; the drop entry's
`macroIds` for `macro.run` and for `item.start`; the list schema at and over its
cap, preload's list read and its rejection; the feed's push, its list of a
startup drop once, standing sources first, a failing source, the unread cap, and
its disposal; the wiring.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes (GitHub CI)
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released
- [x] Caches and lists have size caps (the notes, at most one per batch command)
- [x] An exception in the output path doesn't stop the output (a throwing
      problem listener is reported and changes nothing)
- [x] Only what's needed re-renders (control window): no renderer change
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not relevant

## Decisions I made (for the lead to confirm)

1. One problem per 매크로 that ran, not one per dispatch with a list, so each
   card has one name and its key (`macro-dropped:<macroId>`) replaces an older
   card for the same 매크로 (agreed with visio-c9).
2. The name travels with the problem, as main compiled it, so a rename or a
   delete right after the drop can't change or lose the card's detail line.
3. The drop's log message changes to `dropped live dispatch`, so a drop is told
   apart from one skipped action in the log.
4. Problems go to every window, as `live:changed` does; output windows don't
   subscribe.

## Where to look

- `src/main/live/sliceRegistry.ts`: `ReductionRecord` and the `dropped`
  diagnostic.
- `src/main/live/store.ts`: the order of the diagnostics and the problems.
- `src/shared/schema/appProblem.ts`: the contract spec-45 builds on.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex4): Request changes: a startup 매크로 drop could be
  pushed before any window subscribed, and lost; private TSDoc.
- Round 2 (Codex, codex4): Request changes: the list's 64-entry cap could cut an
  unread drop; the API documentation still said drops were never listed.
- Round 3 (98fd4ef6): reviewer (Codex, codex4) Approve, no findings. Restacked
  afterwards with every commit identical (`git range-diff`). Lead Approve.
  Rebased by the lead onto local `main` without conflicts; typecheck passes.

## Team member's reply

1.

## Round 2 reply

1. [P2] `src/main/ipc.ts:132`, a startup 매크로 drop could be pushed before the
   control window listened, with no replay. Fixed in
   `fix(main): keep one-shot problems until a window reads the problem list`:
   the new `ProblemFeed` (`src/main/problemFeed.ts`) owns both app problem
   channels. It pushes a one-shot problem at once and also keeps it, the newest
   `MAX_UNREAD_PROBLEMS` (16), until a window next calls `problems.list()`,
   which a window does once when it loads, before or after it subscribes. The
   list returns the standing problems, then the unread ones, and clears them, so
   a reload doesn't show them twice. Regression: a `macro.run` dispatched before
   any window lists produces one push and one listed drop, and the next list is
   empty (`problemFeed.test.ts`). `registerIpc` no longer touches problems;
   `src/main/index.ts` registers the feed.
2. Nit: removed the TSDoc from `ReductionRecord`, its `skip`, and the
   `store.test.ts` fixture
   (`style(live): drop the doc comments of internal registry helpers`).

## Round 3 reply

1. [P2] `problemFeed.ts:57`, a full standing list could cut unread startup
   drops. Fixed in
   `fix(main): keep room for unread problems in the problem list`: the unread
   one-shot problems (at most `MAX_UNREAD_PROBLEMS`, 16) always go into the
   reply, and the standing problems get the rest of the
   `APP_PROBLEM_LIMITS.listed` room; a standing problem left out stays with its
   source and is listed again on the next read. Regression: 64 standing problems
   and 2 startup drops list the first 62 standing ones and both drops, and the
   next read lists all 64 standing ones.
2. Nit: `LlpApi.problems.list` now says that the newest unread one-shot problems
   are listed once, that the read clears them, and to subscribe before listing
   (`docs(ipc): describe the one-time replay of unread problems`).
