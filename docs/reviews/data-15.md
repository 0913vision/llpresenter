# Review request: `data-15`

Review range: `a3899ed...refactor/data/required-started-at`

Changed outside data's paths, each with its owner's permission:

- Output's: `src/main/live/reducer.ts`,
  `src/renderer/src/render/backgroundLayer.ts`, and the fixtures in
  `src/renderer/src/render/backgroundLayer.test.ts` and
  `src/renderer/src/render/outputRenderer.test.ts`.
- Shell's: the fixtures in `src/renderer/src/show/ClearRow.test.tsx` and
  `src/renderer/src/state/clear.test.ts`.

- Team member: `data`
- Branch: `refactor/data/required-started-at`
- Base commit (`main`): `a3899ed`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/data.md`; the data-4 follow-up the lead set: make
  `startedAt` required once output stamps it (output-2 merged)

What to check:

1.  `src/shared/live.ts` and `src/shared/schema/liveState.ts`: `startedAt` is
    required, so a live state whose background has no start time is refused at
    the preload.
2.  The two checks that only handled a missing `startedAt` are gone: in
    `resumedMedia` (`reducer.ts`) and in `startOffsetSeconds` and
    `seekOnceLoaded` (`backgroundLayer.ts`). Nothing else in those functions
    changed.
3.  The fixtures that meant "from the beginning" now start at `Date.now()`, so
    they still play from the beginning, and the test that a background less than
    `MIN_SEEK_SECONDS` along isn't sought still runs.
4.  The docs commit also fixes the nit codex3 left in `data-9` round 3.

## Shared changes

1.  `src/shared/live.ts`: `MediaLayer.startedAt` is required. Its TSDoc no
    longer describes a missing start time.
2.  `src/shared/schema/liveState.ts`: `startedAt` is required in the schema.

## What changed and why

When `startedAt` came in (data-4), output's reducer didn't stamp it yet, so it
was optional and "absent" meant "start from the beginning". The reducer has
stamped every new background since output-2, and moves the time on an undo after
a media clear. The optional field only left dead branches that every reader had
to keep. With the field required, the type says what the main process
guarantees, and a window that receives a state without it reports the bad state
instead of guessing.

| File                          | Change                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `reducer.ts` (`resumedMedia`) | `media?.startedAt === undefined` becomes `media === null`.                                                        |
| `backgroundLayer.ts`          | The `startedAt === undefined` checks in `startOffsetSeconds` and `seekOnceLoaded` go.                             |
| Test fixtures                 | Media layers built without `startedAt` get one: `Date.now()` where the test meant "just started", `0` in shell's. |
| `liveState.test.ts`           | "accepts a background without a start time" becomes a rejection case.                                             |

Output noted that `seekOnceLoaded` now always adds its `loadedmetadata`
listener. That is safe: a background that just started is less than
`MIN_SEEK_SECONDS` along, so the listener finds nothing to seek, and it is
removed when the background changes, as before.

Shell's open branches build media layers only in the same two test files; shell
resolves any conflict there when it rebases. Output's `feat/output/preview-mode`
also touches `backgroundLayer.ts`; output rebases it onto this after it merges.

## Changed files

- `src/shared/live.ts`, `src/shared/schema/liveState.ts` and its test.
- Output's and shell's files above.
- `docs/reviews/data-9.md` (the nit) and `docs/reviews/data-15.md` (new).

## Checks run

`npm run verify` on the commit before this document (b5e883b), on `main`
a3899ed: every step passed (174.5 s, steps at once).

| Command or test                    | Result                       |
| ---------------------------------- | ---------------------------- |
| `npm run typecheck`                | Passed (19.0 s)              |
| `npm run lint`                     | Passed (85.8 s)              |
| `npm run format:check`             | Passed (42.0 s)              |
| `npm test`                         | Passed as `test:coverage`    |
| `npm run build`                    | Passed (11.2 s)              |
| `npm run verify` (from phase 1 on) | Passed: every step (174.5 s) |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests: the schema test
      rejects a background without a start time.
- [x] Values from outside the process are validated with a schema
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released: `seekOnceLoaded` keeps removing its
      listener when the background changes.
- [x] Caches and lists have size caps: nothing new is kept.
- [x] An exception in the output path doesn't stop the output: a state without a
      start time is refused at the preload, which keeps the last good state.
- [x] Only what's needed re-renders (control window): no UI change.
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values (when relevant): not measured.

## Decisions I made (for the lead to confirm)

1.  The commit is tagged `break`, because it changes a shared contract, even
    though every producer already sends the field.

## Where to look

- `src/renderer/src/render/backgroundLayer.ts`: `seekOnceLoaded`.

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
