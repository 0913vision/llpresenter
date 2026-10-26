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
- `dispose` stops following, cancels the timer, and waits for the write in
  flight.

The record must survive until the operator answers the recovery dialog. A
crashed launch therefore doesn't start the writer (a `TODO(0913vision)` in
`index.ts` until part 2b starts it after the answer). A launch without a marker
removes a leftover `live.json` before it writes the new marker, so a crash right
after a normal launch never offers the record of an older, cleanly closed
session.

Output-26 nit: the shutdown now marks the session as quitting first (the marker
becomes `<token>\nquitting`, written atomically, only while this launch owns
it). If `SAVE_LIMIT_MS` ends the process before the last step removes the
marker, the next launch logs "the previous session did not finish quitting"
instead of "crashed while running". An unreadable, overlong, or non-file marker
logs "left an unrecognized marker". The launch log moved from `index.ts` into
`session.ts`; the NOTE on the shutdown bound now sits at the shutdown steps.

The record stops second in the shutdown, before the outputs close, so the file
keeps the state from before the quit and not the "output off" that closing
windows cause.

## Changed files

- `src/main/live/recovery/recordWriter.ts` and its test: the writer and the open
  service port.
- `src/main/live/recovery/session.ts` and its test: the stale record removal,
  the quitting mark, and the launch log of the case.
- `src/main/index.ts` and `index.wiring.test.ts`: create the writer, start it
  only on a normal launch, and add the two shutdown steps first.

## Changes outside my paths

None. No shared, preload, data store, or renderer file changes.

## Checks run

| Command or test                                                                     | Result                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------- |
| `npm run typecheck`                                                                 | Pass                                        |
| `npx vitest run src/main/live/recovery src/main/index.wiring.test.ts`               | Pass, 42 tests in 3 files                   |
| `npx eslint src/main/live/recovery src/main/index.ts src/main/index.wiring.test.ts` | Pass                                        |
| `npx prettier --check` on the changed files                                         | Pass                                        |
| Mutation checks (each change restored with `git checkout`)                          | 11 mutations, all fail a test               |
| `npm run verify`                                                                    | On GitHub CI only (see the request message) |

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
- [ ] Measured performance values: not measured; at most one serialization per
      second while the state changes, none while it is still

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
   record on the way out.

## Shared contract change requests

None.

## Where to look

- `recordWriter.ts`: `schedule`, `request`, and the `finally` that follows a
  write in flight with the pending one.
- `session.ts`: `acquireMarker` (the stale record goes before the new marker)
  and the `markQuitting` and `cleanExit` order.
- `index.ts`: the two new first shutdown steps and the crashed launch that
  leaves the record alone.

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
