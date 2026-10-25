# Review request: data-26

- Team member: data
- Branch: `feat/data/live-contracts`
- Base commit: `ed365ffca35f7ae339cb01c56e9430d22e9e11af` (`main`)
- Last source commit: `d2360b833e1637701b7cad8bfc96f10ac6947d16`
- Review range: `ed365ff...feat/data/live-contracts`
- Related brief: `.llp/task.md`, M3-D1b in `docs/plans/m3-breakdown.md`

## What changed and why

Widen `LiveCommand` with Look changes, stage layout overrides and messages, prop
on/off, notice start/pause/stop, targeted messages with display time, timer
start/pause/reset, audio playback and volume, macro runs, item starts, and flat
batches. The six existing command shapes stay compatible.

Preload validates outgoing commands, strips unsupported fields, and logs
malformed requests. New commands have no registered slice yet: regression tests
use the real M3-O0 registry and store to prove that dispatch logs the
unsupported command without changing state, version, undo, or listeners. Even a
batch containing supported children is rejected without applying them.

Move song-output interruption classification into an exhaustive shared function.
The lead explicitly allowed the single shell wiring exception in
`src/renderer/src/state/live.ts` for this request. Existing shell tests are
unchanged and pass. A batch interrupts pending navigation if any child does. New
leaf commands currently return false; their future slice owners must update the
classification when they can interrupt song output.

Carry the data-23 nit: search limits default to 50 and cannot exceed 200.
Replies also reject more than 200 matches. The public request still permits an
absent limit, while parsing supplies the bounded value before IPC.

## Changed files

- `src/shared/commands.ts` and `src/shared/commands.test.ts`
- `src/shared/schema/liveActions.ts` and `liveActions.test.ts`
- `src/shared/schema/liveCommand.ts` and `liveBatch.test.ts`
- `src/shared/schema/librarySearch.ts` and `librarySearch.test.ts`
- `src/preload/index.ts` and `index.test.ts`
- `src/renderer/src/state/live.ts`: import the shared classifier in place of its
  local function; the existing call is unchanged. Lead-authorized exception.

## Checks run

| Command or test                         | Result                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `npm run typecheck`                     | Passed, including after rebase                                            |
| Round 1 targeted Vitest, seven files    | 171 tests passed                                                          |
| Round 2 targeted Vitest, three files    | 29 tests passed                                                           |
| Existing `songBackground.test.ts`       | Included unchanged in the passing run                                     |
| ESLint on changed TypeScript files      | Passed                                                                    |
| `npm run format` and `git diff --check` | Passed                                                                    |
| Local `npm run verify`                  | Not run, per lead instruction                                             |
| GitHub full verification                | Source run below; final review HEAD result accompanies the review request |

Round 1 source CI: **passed**, verified with `node scripts/ci/status.mts`:
https://github.com/0913vision/llpresenter/actions/runs/40195156672 for
`a960eb6a7fabb4aa33a391600489928acc964219`.

## Quality checklist

- [x] New behavior and malformed inputs have tests.
- [x] Cross-process values are checked before forwarding.
- [x] No unchecked type assertions, non-null assertions, or `any`.
- [x] No new subscriptions, timers, windows, or caches.
- [x] New lists are bounded: batch 256, message targets 200, search 200.
- [x] Unsupported commands preserve the last good live state and undo.
- [x] Comments, commit messages, formatting, and owned-path rules followed.

## Decisions I made

- New references use branded UUIDs. Existing commands retain their old string
  IDs. `message.send` is distinct from legacy `message.show`, whose existing
  slice does not implement targets or display duration.
- Stage layout accepts an optional screen, matching the macro action's default
  stage target. Null stage message means take down. Notice start optionally
  selects an image position; absent position resumes an active paused set or
  starts a new set at zero. Audio play without a source resumes paused audio;
  explicit sources identify a media item or a playlist and zero-based position.
  Operator fade out is three seconds. Volume is a percentage from 0 to 100.
- A message requires nonblank text, at least one unique target or `all`, and an
  explicit duration in seconds or null. Target existence is checked later by the
  owning slice, as with every other referenced object.
- Batches are flat and may be empty. `parseLiveCommand` remains strict, so
  `isLiveCommand` never claims an invalid child is typed. The separate
  `parseLiveCommandRequest` retains valid children in order and returns indexed
  rejection errors; preload logs each error before forwarding the normalized
  batch. Malformed envelopes and oversized batches reject the whole request.
  This follows spec 01's per-action skipping rule.

## Integration boundaries and where to look

No live slices, live-state fields, output execution, macro expansion, or item
start behavior are implemented here. M3-O10 must adopt `parseLiveCommandRequest`
at main's IPC entry when transactions are enabled, log its rejected fields, and
apply the remaining children in one transaction. Main currently retains its
strict parser and rejects every batch through the unsupported-command path. O4
through O7 and tools' macro module implement the other new tags. The new
regression tests make these staging limits explicit.

In round 1 the branch was rebased once onto `main` after data-23, data-24, and
data-25 merged. Their reviewed feature branch references were not rewritten.

## Review: lead

- Verdict: pending
- Findings:

## Review: reviewer

- Verdict: pending
- Findings:

## Team member's reply

### Round 2

1. `interruptsSongOutput` now returns
   `command.commands.some(interruptsSongOutput)` for `live.batch`. Tests cover
   each interrupting child (`slide.show`, `media.show`, `clear.undo`, and clear
   targets all/slide/media), including an unrelated command before it. Empty and
   unrelated-only batches return false. The existing shell tests remain
   unchanged and pass.
2. Shorten `LiveAction` TSDoc to describe the type. Per-action defaults remain
   in the behavior spec rather than being repeated in the type comment.

Rebased onto main `ed365ff` before the round 2 push. Fast checks above passed;
the round 2 request links the fully green CI run of the final review HEAD.
Data-27 follows this response; its restack and final HEAD CI result accompany
the round 2 request.
