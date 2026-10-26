# Review request: `output-40`

- Team member: `output`
- Branch: `feat/output/stage-slice`
- Base and range: in the review request message.
- Scope: M3-O5a, the data the 무대 화면 draws, with the three contracts the lead
  approved on October 26: the next 장 sent with `slide.show`, the stage layout
  chosen for this output (`stage.layout.set`), and the stage 타이머
  (`stage.timer.set`). The stage layout layer that draws them follows as M3-O5b.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## Shared contract changes (review first)

All additive, with valid and invalid tests and caps:

- `SlideLayer.next?: NextSlide` (`{label, lines}`) in `src/shared/live.ts`,
  checked by the slide schema in `src/shared/schema/liveState.ts`, which both
  the live state and `slide.show` use. Its lines share the slide's line cap
  (`slideLines`) and its label the text cap. Absent means no next 장.
- `LiveState.stageLayouts?: Record<ScreenId, StageLayoutId>`, capped at
  `LIVE_STATE_LIMITS.outputs`, and `LiveState.stageTimerId?: TimerId`.
- `stage.timer.set {timerId: TimerId | null}` in
  `src/shared/schema/liveActions.ts`, plus its case in `interruptsSongOutput`
  (it doesn't interrupt song output).

## What changed and why

- The control window sends the next 장: `slideLayerOf` (`show/slideLayer.ts`),
  the one place every 장 output builds its layer, adds the item's next tile and
  leaves `next` out after the last. Main checks it through the command schema
  like the rest of the slide. Spec 03 notes the limit: if the 구성 changes while
  a 장 is live, next updates with the next `slide.show`.
- `stageSlice` (`src/main/live/slices/stage.ts`, new):
  - `stage.layout.set` checks the layout in `stage-layouts.json` and, when
    given, that the screen is a saved stage screen. Without a screen it sets
    every saved stage screen. A repeat changes nothing.
  - `stage.timer.set` checks the 타이머 in `timers.json`; `null` clears it and
    drops the field. A repeat changes nothing.
- `look.set` drops `stageLayouts` when the Look changes (a NOTE), so each stage
  screen takes the new Look's layout. Clears don't touch either field, and
  neither is saved or recovered: the recovery plan builds its commands from an
  explicit list.
- `stageRefreshCommands` (`overlayRefresh.ts`), run by the same settings
  subscription as the overlay refresh, clears the stage 타이머 once
  `timers.json` no longer has it.
- Spec 03 and 04: the next 장 sender and the stage 타이머, marked "(lead
  decision, October 26)".

## Changed files

- `src/shared/live.ts`, `src/shared/commands.ts`,
  `src/shared/schema/liveState.ts`, `src/shared/schema/liveActions.ts`, and
  their tests.
- `src/main/live/slices/stage.ts` (new), `slices/look.ts`, `overlayRefresh.ts`,
  `overlays.ts`, and `src/main/live/stage.test.ts` (new).
- `src/renderer/src/show/slideLayer.ts` and its test.
- Tests whose expected `slide.show` now carries `next`:
  `src/renderer/src/state/show.test.ts`, `state/showLibrary.test.tsx`,
  `show/bible/actions.test.ts`.
- `docs/spec/03-output.md`, `docs/spec/04-show.md`.

## Changes outside my paths

- `src/shared/` (data): the additive contracts above.
- `src/renderer/src/show/slideLayer.ts` (shell): the sender change the lead
  asked me to make, and the three tests above, which only add the expected
  `next`.

## Checks run

| Command or test                                                                                           | Result                                   |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                                                                       | Pass                                     |
| `npx vitest run src/main src/shared src/renderer/src/state src/renderer/src/show src/renderer/src/render` | Pass, 3168 tests (the native test skips) |
| `npx eslint` and `npx prettier --check` on the changed files                                              | Pass                                     |
| Mutation checks (`.llp/output-40/mutations.log` in the worktree)                                          | 16 mutations, all fail a test            |
| `npm run verify`                                                                                          | GitHub CI only (see the request message) |

Two lines marked NO-MATCH in the log missed reformatted code and ran again
against the current lines.

Tests: the layout for one stage screen and for all of them, the version bump, a
repeat; a missing layout, an audience screen, and an unknown screen skipped as
missing targets; the override surviving clears and the same Look, and gone after
another Look; the stage 타이머 set, repeated, kept across a Look change,
cleared, and a missing one skipped; a deleted 타이머 letting go through the
settings refresh; the next 장 kept with the live one through a clear and its
undo; the sender's next tile and none after the last; and the schemas with their
caps.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI, see the request message)
- [x] `npm run format:check` passes (changed files)
- [x] Every new behavior has unit tests
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every listener and timer is released
- [x] An exception in the output path doesn't stop the output
- [x] The clean code rules and comment rules in `CLAUDE.md` hold
- [x] The change is small and focused

## Decisions I made (for the lead to confirm)

1. `stage.layout.set` without a screen sets every stage screen saved at that
   moment; a stage screen added later takes the Look's layout.
2. `stage.layout.set` for an audience screen is a missing target, not a silent
   no-op.
3. Choosing the same Look again keeps the override, since nothing changes.

## Shared contract change requests

None beyond the additive contracts above.

## Where to look

- `src/main/live/slices/stage.ts`.
- `src/main/live/slices/look.ts`: the dropped `stageLayouts`.
- `src/renderer/src/show/slideLayer.ts`.

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
