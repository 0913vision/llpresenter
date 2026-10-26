# Review request: `output-39`

- Team member: `output`
- Branch: `feat/output/test-pattern`, stacked on
  `feat/output/picture-correction` (output-38).
- Base and range: in the review request message (output-38's head to this
  branch).
- Scope: M3-O9b, the 테스트 패턴 (test pattern) part, which closes O9b:
  `screen.testPattern.set` shows the pattern on a screen's real output and its
  previews, drawn with the screen's picture correction.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## Shared contract changes (review first)

- `src/shared/live.ts`: `LiveState.testPatterns?: readonly ScreenId[]`, the
  screens that show the pattern. Absent means none. Clears never touch it.
- `src/shared/schema/liveState.ts`: its schema. A list of screen UUIDs, each at
  most once, capped at `LIVE_STATE_LIMITS.outputs` (200), the same cap as the
  output switches. Tests: valid, a duplicate, a non-UUID, and the cap from both
  sides.

Both are additive: an old window ignores the field, and an old record parses.

## What changed and why

- `testPatternSlice` (`src/main/live/slices/testPattern.ts`, new): adds or
  removes the screen. Only a saved screen can show it (a missing one is skipped
  as `missing-target`); hiding works for any screen, so a pattern on a screen
  that was deleted can still be turned off. A repeat changes nothing, the field
  is dropped once no screen shows the pattern, and a screen past the cap fails
  the command instead of growing the state.
- Recovery: the plan builds its commands from an explicit list, so a restart
  never brings a pattern back; a test pins it.
- `RenderScreen.name` (optional) and `RenderFrame.testPattern`: `ScreenFrames`
  marks the frame when the live state lists the screen.
- `TestPatternView` (`render/testPattern.ts`, new) and its layer
  (`layers/testPattern.ts`, order 7, above every other layer, no Look switch).
  It is built once: seven bars at full strength over an 11-step gray ramp, a 2
  px white border at the picture edge, and a centred label. After that it only
  shows, hides, and relabels. The label is the screen name and, in an output
  window, the device pixels the window covers (`clientWidth` times
  `devicePixelRatio`), so a 4K monitor at 150% reads "3840×2160" and a 창
  follows its size on resize. A preview prints the name only, since it can't
  know the output's size (the lead's decision). The text is written only when it
  changes. The layers underneath keep playing, so the content is back at once.
- `testPattern.module.css`: the signal colors are fixed values, with a NOTE that
  they are a test signal, not UI. `.pattern[hidden]` restores `display: none`,
  which the class's own `display: grid` would otherwise override.
- Spec 06: the label and how long the pattern stays (proposal and lead
  decision).

## Changed files

- `src/shared/live.ts`, `src/shared/schema/liveState.ts` and its test.
- `src/main/live/slices/testPattern.ts` (new),
  `src/main/live/testPattern.test.ts` (new), and
  `src/main/live/recovery/plan.test.ts`.
- `src/renderer/src/render/layer.ts`, `screenIdentity.ts`, `screenFrames.ts`,
  and their tests.
- `src/renderer/src/render/testPattern.ts`, `testPattern.module.css`,
  `layers/testPattern.ts` (new), a jsdom test, and a node test of the CSS.
- `docs/spec/06-settings.md`.

## Changes outside my paths

- `src/shared/` (data): the additive field and schema above.

## Checks run

| Command or test                                                                                                                  | Result                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                                                                                              | Pass                                     |
| `npx vitest run src/renderer/src/render src/renderer/src/output src/renderer/src/show src/main/live src/main/outputs src/shared` | Pass, 2103 tests (the native test skips) |
| `npx eslint` and `npx prettier --check` on the changed files                                                                     | Pass                                     |
| Mutation checks (`.llp/output-39/mutations.log` in the worktree)                                                                 | All fail a test (see below)              |
| `npm run verify`                                                                                                                 | GitHub CI only (see the request message) |

Every mutation fails a test. Three survived a first run and fail since the tests
that pin them (the log shows both runs): the version bump, the relabel on
resize, and the layer passing the preview mode. Two lines marked NO-MATCH were
typos in the mutation command, run again correctly.

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

1. The pattern stays through clears and 되돌림 and never comes back after a
   restart; only 화면 설정 turns it off (spec 06 already ties it to that page).
2. Showing needs a saved screen; hiding works for any screen.
3. The label uses `--font-ui` at 48 px on a 1080-line picture, scaled like lyric
   sizes.

## Shared contract change requests

None beyond the additive field.

## Where to look

- `src/main/live/slices/testPattern.ts`.
- `render/testPattern.ts`: `relabel`.
- `testPattern.module.css`: `.pattern[hidden]`.

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
