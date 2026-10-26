# Review request: `output-29`

- Team member: `output` (Claude session that took over from Codex)
- Branch: `feat/output/recovery-record`
- Base: `6f8724fd` (`main`); range: `6f8724fd..feat/output/recovery-record`.
- Scope: M3-O8 part 2a, the recovery record writer and the session marker, plus
  the output-26 nit (which case left `session.lock`). Part 2b (`output-30`,
  stacked on this branch) adds the planner, `recovery.summary`,
  `recovery.apply`, `recovery.startFresh`, and 켤 때 화면 출력.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## What changed and why

Spec 02 asks the main process to write the output state to `recovery\live.json`
as it changes, so a crash can offer it back. `RecoveryRecordWriter` follows the
live store and writes data-42's `llrecovery` record atomically:

- One write at start, then at most one write per second while the state changes
  (the spec 02 proposal). A change only arms the single interval timer when none
  is armed, so a burst of changes costs nothing per change.
- One write in flight. A change during a write sets one pending flag, and the
  next write takes the newest state.
- Audio and clear undo are never saved (`layers.audio: null`, `canUndo: false`).
  Timers aren't in the live state yet.
- `serviceId` is the open 예배 순서 at the time of the write. Before the content
  is read, it is `null`.
- A failed write or a state the record can't hold keeps the previous file and
  logs one warning per run of failures, then one info line when a write succeeds
  again.
- `stop` stops following, cancels the timer, and drops later writes at once.
  `settled` resolves when the write in flight, if any, has finished.

The record must survive until the operator answers the recovery dialog. A
crashed launch therefore doesn't start the writer (a `TODO(0913vision)` in
`index.ts` until part 2b starts it after the answer). A launch without a marker
removes a leftover `live.json` before it writes the new marker, so a crash right
after a normal launch never offers the record of an older, cleanly closed
session. Launch also removes the temporary files that an interrupted atomic
write left in the recovery folder (`removeStaleTempFiles`, the data store's
helper).

Output-26 nit: the shutdown now marks the session as quitting first (the marker
becomes `<token>\nquitting`, written atomically, only while this launch owns
it). If `SAVE_LIMIT_MS` ends the process before the last step removes the
marker, the next launch logs "the previous session did not finish quitting"
instead of "crashed while running". An unreadable, overlong, or non-file marker
logs "left an unrecognized marker". The launch log moved from `index.ts` into
`session.ts`; the NOTE on the shutdown bound now sits at the shutdown steps. The
case stays inside the session module: the recovery dialog has no place to show
it.

The record stops second in the shutdown, before the outputs close, so the file
keeps the state from before the quit and not the "output off" that closing
windows cause. The shutdown waits for its last write only after the data store
has closed, just before the marker is removed, so a slow recovery write never
takes time from the must-save steps inside `SAVE_LIMIT_MS`.

## Changed files

- `src/main/live/recovery/recordWriter.ts` and its test: the writer and the open
  service port.
- `src/main/live/recovery/session.ts` and its test: the stale record removal,
  the quitting mark, and the launch log of the case.
- `src/main/index.ts` and `index.wiring.test.ts`: create the writer, start it
  only on a normal launch, stop it and mark quitting first in the shutdown, and
  wait for its last write after the data store closes.

## Changes outside my paths

- `scripts/bench/liveFixtures.ts` (new) and
  `scripts/bench/liveAdmission.test.ts`: data-42's typical and heavy legal
  states move into a shared fixture module without change, so the recovery
  record bench reuses them instead of a copy.
- `scripts/bench/recoveryRecord.test.ts` (new): the opt-in record cost bench
  (skipped unless `LLP_RECOVERY_BENCH=1`).

No shared, preload, data store, or renderer file changes.

## Checks run

| Command or test                                                                          | Result                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| `npm run typecheck`                                                                      | Pass                                        |
| `npx vitest run --no-fsModuleCache src/main/live/recovery src/main/index.wiring.test.ts` | Pass, 43 tests in 3 files                   |
| `npx eslint src/main/live/recovery src/main/index.ts src/main/index.wiring.test.ts`      | Pass                                        |
| `npx prettier --check` on the changed files                                              | Pass                                        |
| Mutation checks (each change restored with `git checkout`)                               | 11 mutations, all fail a test               |
| `npm run verify`                                                                         | On GitHub CI only (see the request message) |

Two survived the first run and failed after the tests were tightened (one timer
per interval; a quit mark during a clean exit). The mutations: keep `canUndo`,
keep audio, drop the pending flag, arm a timer per change, log every failure,
skip waiting for the write in flight, keep the store subscription on dispose,
skip the stale record removal, write the plain token as the quitting mark, mark
quitting during a clean exit (three runs), and start the writer after a crash.

No local Electron, visible window, soak, or memory run. Tests use fake stores,
fake timers, and temporary folders.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI, see the request message)
- [x] `npm run format:check` passes (changed files)
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema (the record
      goes through data-42's serializer; the marker is read with a byte cap)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription and timer is released
- [x] Caches and lists have size caps (one timer, one write, one pending flag;
      the record is capped at 4 MiB by data-42)
- [x] An exception in the output path doesn't stop the output (every write path
      catches and logs; the store listener only arms a timer)
- [x] Only what's needed re-renders (no renderer change)
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused
- [x] Measured performance values: see "Record cost" below

## Record cost

Measured with `scripts/bench/recoveryRecord.test.ts` on this PC (Windows, Node
v24.20.0, Intel Core i7-7700K at 4.20 GHz), seven samples after two warm-up
calls, median of the per-sample mean. "Serialize" is the writer's work per
write: the schema check, stable JSON, and the byte limit check. "Parse" is the
read after a crash, once per launch. The heavy state is data-42's largest legal
state (200 outputs and four aliases, 1,000 slide lines and 200 messages of 3,000
characters, 512 notice images).

| State   | Record bytes | Serialize ms | Parse ms |
| ------- | -----------: | -----------: | -------: |
| Typical |          779 |        0.036 |    0.041 |
| Heavy   |    3,699,922 |        16.35 |    11.55 |

The heavy write blocks the main process for about 16 ms at most once per second
while the state keeps changing, and not at all while it is still. A real service
state costs well under 0.1 ms. These are short CPU measurements on a shared
machine, not soak or memory measurements. To rerun:

```powershell
$env:LLP_RECOVERY_BENCH = '1'
npx vitest run --no-fsModuleCache scripts/bench/recoveryRecord.test.ts
Remove-Item Env:LLP_RECOVERY_BENCH
```

## Decisions I made (for the lead to confirm)

1. The writer writes once at start, so the record always belongs to the current
   session, and folds later changes into one write per second.
2. A change of the open 예배 순서 alone doesn't write; the next live change
   carries the new `serviceId`. The live state doesn't change when only the open
   service changes, and part 2b checks the live 슬라이드's item against the
   recorded service.
3. The quitting mark lives in the marker file itself (a second line), so the
   case is known even when the record or the data store failed.
4. The shutdown stops the record before the outputs, and doesn't write a last
   record on the way out; it only waits for a write already in flight, after the
   data store closes.

## Shared contract change requests

None.

## Where to look

- `recordWriter.ts`: `schedule`, `request`, and the `finally` that follows a
  write in flight with the pending one.
- `session.ts`: `acquireMarker` (the stale record goes before the new marker)
  and the `markQuitting` and `cleanExit` order.
- `index.ts`: the two new first shutdown steps, the wait for the last write
  before the marker goes, and the crashed launch that leaves the record alone.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (Claude, review2-3e): Request changes: shutdown awaited the recovery
  write before the must-save steps inside one 3 s budget; three nits.
- Round 2 (925848c3): reviewer (Claude, review2-3e) Approve with no new
  findings: the writer stops synchronously early and its last write is awaited
  only after the data store closes; temp files in the recovery folder are
  cleaned at launch; the heavy record costs 16.35 ms at most once a second. Lead
  Approve. Written by the Claude session that took over output's work. Rebased
  by the lead onto local `main` without conflicts.

## Team member's reply

Round 1 (reviewer B, Request changes):

1. Split. `stop()` is synchronous and runs second in the shutdown; `settled()`
   runs after "close the data store", "stop serving media", and "remove the IPC
   channels", just before "finish the recovery session". The wiring test holds
   the last write open and checks that `app.json` and the data store are saved
   before the wait starts and that the marker is removed only after it ends.
2. `openRecoverySession` calls `removeStaleTempFiles` on the recovery folder
   before it reads the marker. Tested with a stale and a current temporary file;
   a recovery folder that is a file now logs that too.
3. Measured and recorded in "Record cost", with the bench committed.
4. Dropped `leftWhile` from `RecoverySession`. output-30's dialog has no place
   for the case, so only the launch log (the output-26 nit) uses it.

Three more mutations fail a test: awaiting the write in the early step, skipping
the temporary file cleanup, and writing after `stop`.
