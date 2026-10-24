# Review request: `data-4`

- Team member: `data`
- Branch: `refactor/data/live-command-schema`, stacked on `data-6`
  (`feat/data/undo-and-columns`)
- Base commit (`main`): `4aa7901`
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

`npm run verify` on `main` 4aa7901 with `data-5` and `data-6` below: typecheck,
lint, and format:check passed. test:coverage ran every test file that started:
61 files, 613 tests passed and 1 skipped. Four files failed to start, and verify
stopped there.

| Command or test                    | Result                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| `npm run typecheck`                | Passed                                                            |
| `npm test`                         | 613 passed, 1 skipped; 4 files didn't start (see below)           |
| `npm run format:check`             | Passed                                                            |
| `npm run build`                    | Passed when run alone                                             |
| `npm run verify` (from phase 1 on) | Failed at test:coverage only because of the worker timeouts below |

The four files that didn't start are ui's, not touched here:
`src/renderer/src/ui/Checkbox.test.tsx`, `NumberField.test.tsx`,
`Select.test.tsx`, and `TextField.test.tsx`. Vitest reported "Timeout waiting
for worker to respond" while the machine was busy. Run alone, the four pass (43
tests). The rules say to record machine-load failures in tests I didn't touch
rather than rerun everything.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes: all but the worker timeouts above.
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
- [ ] Measured performance values (when relevant): not relevant.

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
