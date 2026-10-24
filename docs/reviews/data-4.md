# Review request: `data-4`

- Team member: `data`
- Branch: `refactor/data/live-command-schema`, stacked on `data-6`
  (`feat/data/undo-and-columns`)
- Base commit (`main`): `b9392d0`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`, task 7; the lead approved the plan

Shared changes (the lead allowed `commands.ts` and `guards.ts` for this
request):

- `src/shared/commands.ts`: `isLiveCommand` keeps its signature and now asks the
  schema.
- `src/shared/guards.ts`: only `UnknownRecord`, `isRecord`, and `isString`
  remain, and the `TODO(0913vision)` at the top is gone.
- `src/shared/schema/liveCommand.ts` (new): `parseLiveCommand`.
- `src/shared/schema/liveState.ts`: shares its layer schemas and
  `mediaChoiceSchema` with the command schema.
- `src/preload/index.ts`: the qa nit from `data-5` (see below).
- `src/main/ipc.ts` and `src/main/ipc.test.ts` (new): output's files, changed
  with output's permission in round 2. The command listener parses once and
  dispatches the parsed command.
- `src/shared/ipc.ts`, `src/shared/schema/macros.test.ts`,
  `src/shared/schema/labels.ts`, and `labels.test.ts`: nits from `data-6`,
  `data-3`, and `data-2`.

## What changed and why

Brief task 7 asked to replace the hand-written guards with the schema library if
it makes them simpler. The approved plan:

- `src/shared/schema/liveCommand.ts` holds the command schema, a `v.variant` on
  `type` with one object per command. It reuses the layer schemas of
  `liveState.ts`, so a slide or a message is checked the same way in a command
  and in a state.
- `parseLiveCommand(value)` returns a `Result` whose error names the failing
  field (`target`, `slide.lines.0`, and so on), so the main process can log why
  it dropped a command. Unknown fields are dropped; a `startedAt` that a window
  sends in `media.show` never reaches the reducer.
- `isLiveCommand(value)` in `commands.ts` keeps its signature and delegates to
  `parseLiveCommand`. Callers don't change, and `commands.test.ts` passes
  unchanged.
- `guards.ts` loses the five guards that only the old check used. `colors.ts`
  and the schema pipeline still use `isRecord`, `isString`, and `UnknownRecord`.

Also in this request, a nit from qa's test of `data-5` in the built app: when a
reply error has no field, the preload's log detail no longer starts with ": ".

## Changed files

- See "Shared changes", and the tests `liveCommand.test.ts` (new) and
  `src/preload/index.test.ts`.
- `docs/reviews/data-4.md` (new).

## Checks run

`npm run verify` on the commit before this document, on `main` b9392d0 with
`data-6` below it: every step passed. The one skipped test belongs to another
member's suite.

| Command or test                    | Result                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                                |
| `npm test`                         | Passed: 90 files, 922 tests and 1 skipped                             |
| `npm run format:check`             | Passed                                                                |
| `npm run build`                    | Passed                                                                |
| `npm run verify` (from phase 1 on) | Passed: typecheck, lint, format:check, test:coverage, build (232.7 s) |

Round 1's verify had four of ui's test files fail to start under machine load;
round 2's verify ran clean.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: none are registered.
- [x] Caches and lists have size caps: none are kept.
- [x] An exception in the output path doesn't stop the output: the check never
      throws.
- [x] Only what's needed re-renders (control window): no UI.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [x] Measured performance values (when relevant): the schema checks 136,000 to
      404,000 commands per second (3 to 7 us each) in three rounds, against 28
      to 68 million for the old hand-written guard. Commands arrive at the speed
      of an operator's clicks, and one frame is 16.7 ms, so the cost doesn't
      show.

## Decisions I made (for the lead to confirm)

1. `MediaLayer.startedAt` stays optional. Output asked to make it required only
   after its stamping merges, and output hasn't said so yet. A later request
   makes the change.
2. Commands drop unknown fields, like the other IPC payloads, so the reducer
   only sees what the command type declares.

## Shared contract change requests

- None beyond this request.

## Where to look

- `src/shared/schema/liveCommand.ts`, and `isLiveCommand` in
  `src/shared/commands.ts`.

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

Round 2, replies to the reviewer's findings:

1. Parse once at the boundary: fixed. With output's permission,
   `src/main/ipc.ts` calls `parseLiveCommand`, logs `command.error` (the field
   and the message) for a malformed command, and dispatches `command.value`. A
   new `src/main/ipc.test.ts`, which mocks only `ipcMain` and `BrowserWindow` as
   output asked, checks two things: a `media.show` with `startedAt` and an
   unknown field reaches `store.dispatch` without them, and a malformed command
   is logged with its field and never dispatched.
2. Arrays and inherited fields: fixed at both levels.
   - The command schema now starts with `plainObject`, which accepts only an
     object whose prototype is `Object.prototype` or `null`.
   - The layer schemas use `payloadObject`, which does the same.
   - Tests cover `Object.assign([], {type: 'clear.undo'})`,
     `Object.create({type: 'clear.undo'})`, and a layer that is an array with
     the right fields.
3. Sparse lines: I reject holes, because a hole is not a line. The old guard
   used `every`, which skips holes, so it let `[, '아멘']` through. The schema
   checks every index and fails at `slide.lines.0`. The differential test shows
   both: `every` over the array is true, and the parse fails.
4. Performance: measured and recorded in the checklist above.

Nits from other reviews, done here as the lead asked:

- `data-6`: `setLayout`'s TSDoc in `src/shared/ipc.ts` now mentions the
  thumbnail columns.
- `data-3`: the both-targets `clearLayer` test now uses layer `slide` with a
  valid prop id. `prop` is a valid layer kind too, but `slide` makes it plain
  that only the mutual exclusion fails.
- `data-2`: the private `jumpKeySchema` has no TSDoc, and a new test shows that
  `serializeLabels` refuses an invalid key instead of writing `null`.
