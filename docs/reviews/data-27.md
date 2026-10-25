# Review request: data-27

- Team member: data
- Branch: `feat/data/screen-recovery-contracts`
- Stacked base: `7da54c7feb98ce8d9c70152f2d2c87c295135179` (data-26 round 2)
- Last source commit: `6d49bda684ab14bc4db6a7d89b805c7524ea70ee`
- Review range: `7da54c7...feat/data/screen-recovery-contracts`
- Main base: `ed365ffca35f7ae339cb01c56e9430d22e9e11af`
- Related brief: `.llp/task.md`, M3-D1c in `docs/plans/m3-breakdown.md`

## What changed and why

Add the shared screen and recovery contracts before M3-O8, O9a, and O9b
implement them. Screen commands cover test pattern on/off per screen,
three-second monitor identification, and applying a complete screen
configuration to live output. All remain unsupported until output registers
their slices, and the real store regression proves that they log without
changing live state. Their interruption classification is false in this staging
request. No shell files change here.

Expose checked `recovery.summary()`, `recovery.apply({savedAt, rows})`, and
`recovery.startFresh()` through preload. Summary is null when no dialog is
needed, or contains the eligible outputs, slide, and showing rows. It exposes
display summaries rather than the recovery record. Applying a choice names the
offered record so main can refuse stale selections. Typed results keep a domain
refusal distinct from a transport or schema failure.

## Changed files

- `src/shared/schema/screenCommands.ts` and `screenCommands.test.ts`
- `src/shared/schema/screens.ts`: export the existing screen schema.
- `src/shared/schema/recovery.ts` and `recovery.test.ts`
- `src/shared/schema/liveCommand.ts`: register screen variants and safely
  preserve unknown configuration fields through the file-schema checker.
- `src/shared/commands.ts`: widen the union and exhaustive classification.
- `src/shared/ipc.ts`: three recovery channels and typed API methods.
- `src/preload/index.ts` and `index.test.ts`: validate requests and replies.
- `src/shared/testing/fakeLlpApi.ts` and `fakeLlpApi.test.ts`: complete defaults
  and override support for the expanded API.

## Checks run

| Command or test                                              | Result                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `npm run typecheck`                                          | Passed                                                              |
| Original targeted Vitest, nine files                         | 182 tests passed                                                    |
| Restack targeted Vitest, six files                           | 112 tests passed, including unchanged shell tests                   |
| ESLint on changed TypeScript files                           | Passed                                                              |
| `npm run format` and `git diff --check`                      | Passed                                                              |
| `git range-diff` after stacking on the data-26 review commit | Both source changes identical                                       |
| Local `npm run verify`                                       | Not run, per lead instruction                                       |
| GitHub full verification                                     | Source run passed; final HEAD result accompanies the review request |

Original source CI: **passed**, verified with `node scripts/ci/status.mts`:
https://github.com/0913vision/llpresenter/actions/runs/40195613279 for
`c51855f365bbc4bec3b4142973b21fac659fd5b9`.

## Quality checklist

- [x] Schemas cover valid inputs, malformed requests and replies, and refusals.
- [x] Commands without slices preserve the last good output state.
- [x] Summary rows are unique and bounded at three; output screen lists are
      unique, nonempty, and bounded at 200; choices are unique and nonempty.
- [x] Slide positions must fall within a positive slide count; showing rows
      require something to restore. Audio and timers cannot be restore choices.
- [x] Unknown screen settings survive both parsers, including reserved keys.
- [x] No unchecked assertions, `any`, non-null assertions, listeners, timers,
      caches, window creation, output rendering, or disk I/O added.
- [x] Only data's owned files changed; no additional shell exception used.

## Decisions I made

- `screen.settings.apply` carries one complete existing screen configuration for
  live application. It does not save, create, or remove a screen. Persistent
  edits use data-25's `settings.edit` with `name: 'screens'`; D2 and output's
  integration must connect saved settings to live application without a second
  writer. The screen ID lives in the configuration rather than being duplicated
  in the envelope. File defaults and future fields are retained.
- `screen.testPattern.set` carries a branded screen ID and boolean. The owning
  UI turns it off on leaving screen settings; output implements its rendering
  and correction. `monitors.identify` has no arbitrary duration or display IDs:
  it means every physical monitor for the spec's three seconds.
- Recovery row tags are `outputs`, `slide`, and `showing`. Output rows contain
  screen IDs and names; slide rows contain service/item IDs, title, zero-based
  position, and slide count; showing rows contain counts of messages, props,
  stage messages, notices, and stage layout overrides. Main omits empty rows and
  missing slide items; an entirely empty offer is null.
- `savedAt` is the existing record timestamp and also the apply token. Main
  rejects a changed record as `stale`, or a missing/unavailable selection as
  `unavailable` or `invalid-selection`. `apply-failed` reports an unsuccessful
  application. Success has a null value. Malformed replies and failed invokes
  log and reject, consistent with the other checked preload calls.

## Integration boundaries and where to look

This request supplies contracts, not recovery persistence, dialog UI, output
windows, or live screen implementation. No recovery IPC handlers are registered
yet; invoking a missing handler rejects and logs rather than claiming success.
M3-O8 owns summary construction, applying outputs then slide/background then
showing items, suppressing restored-item and startup macros, and normal startup
preferences/macros for start fresh. Audio and timers are never restored.
M3-O9a/O9b own screen command slices and monitor overlays.

Review the recovery schema's relational checks, preload's transport/refusal
distinction, and the real-store unsupported-command regression. The branch was
stacked on data-26 and checked against main once. It is now restacked on the
round 2 data-26 response; the final HEAD run is linked in the restack request.

## Verdicts (recorded by the lead at merge)

- Round 1 (ced1df2): reviewer (Claude, trial-97) Approve. Nit for the next data
  branch: `src/shared/schema/screenCommands.ts:22` and
  `src/shared/schema/recovery.ts:120` TSDoc restate runtime rules that belong to
  spec 03 and 08 and the owning slices; keep type comments to what the types
  are. Lead Approve. Written by the Codex session that took over data's work.
  Rebased by the lead onto local `main` after data-26 without conflicts. D1b and
  D1c are complete.

## Team member's reply

### Restack after data-26 round 1

Restack on data-26's batch interruption fix. The switch conflict was resolved by
retaining `live.batch`'s child-based classification and adding only the three
screen command cases to the false group. The screen and recovery contracts and
preload behavior are unchanged. The restack request includes the fast-check
results and a fully green CI run of this final HEAD.
