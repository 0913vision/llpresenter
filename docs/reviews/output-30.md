# Review request: `output-30`

- Team member: `output`
- Branch: `feat/output/recovery-answer`
- Base and range: in the review request message (rebased onto `main` after
  output-32 and output-31).
- Scope: M3-O8 part 2b. The recovery planner, `recovery.summary`,
  `recovery.apply`, `recovery.startFresh`, their IPC channels, and 켤 때 화면
  출력 (the lead's 08:30 answer: one helper for a normal launch and 새로 시작).
  Part 2a (output-29, merged) writes the record and keeps it after a crash.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## What changed and why

Spec 08 "Crash and restart" and spec 02 (with spec-41's record wording) ask for
a standby launch after a crash, a dialog of three rows built from the record,
and two answers. D1c's contract (`src/shared/schema/recovery.ts`, the preload
`recovery` API) already exists; this request answers it in main.

### Planner (`plan.ts`)

`planRecovery(record, {settings, content})` is a pure function that both the
summary and the restore use, so the dialog never offers what can't be applied.
It returns one step per row, in spec 08's apply order, each with its display row
and the existing live commands that restore it. A row with nothing left is left
out.

- 화면 출력: every saved screen that can show output (not NDI) whose state key
  or compatible alias (`main`, `broadcast`, `captions`, `stage`) was on, with
  its current name. `output.set` turns each one on.
- 마지막 슬라이드: the recorded 슬라이드 as it was captured (spec-41), and its
  background with `media.show`. The row needs the item to be a song item that
  still exists in some service (the recorded one is searched first) with its
  song, and the position inside its current 구성; the title and the count come
  from there ("<title> 2 / 9"). Otherwise the row is hidden (spec 08).
- 표시 중이던 항목: 소품 still in `props.json` (`prop.set`, so they take their
  current saved content, as the overlay refresh does); 메시지 with the display
  time they had left at `savedAt` (`message.send`), dropping expired ones and
  screens that are gone, and turning `all` minus excluded screens into the
  remaining list; an M2 message layer as it was (`message.show`); the stage
  message; the 공지 from the image it showed, found in its current set
  (`notice.start` with that position, then `notice.pause` if it was paused).
  Stage layouts count 0 until M3-O5 adds them to the state (a `TODO`).

Reusing the commands keeps every slice's validation, caps, missing-target
handling, undo rules, and the main clock: restored items start from now with the
time they had left, which is the clock rebasing data-42 left to output.

`lookCommands` adds the record's Look when it still exists in `looks.json`
(spec-41); otherwise the saved current Look stays.

### Controller (`controller.ts`)

- Normal launch: start the record (output-29) and apply 켤 때 화면 출력.
- Crash: read `live.json` once (missing, unreadable, over 4 MiB, or invalid is
  logged and treated as nothing to restore) and wait for the settings and the
  content. Outputs stay off, the record stays on disk, startup 매크로 stay held
  (output-26 registers macros in restore mode).
- `summary()`: the rows and `savedAt`, or null.
- `apply({savedAt, rows})`: refuses `stale` for another `savedAt` and
  `invalid-selection` for a row that isn't offered, and keeps waiting. Otherwise
  it re-plans with the current settings and applies the Look and the checked
  rows' commands in row order, whatever order the request lists them, in
  `live.batch` transactions of at most 256 commands (one broadcast for a real
  service), without start or startup 매크로. A restore that changes nothing
  (every command rejected) answers `apply-failed` and is logged.
- `startFresh()`: start the record, apply 켤 때 화면 출력, then run the startup
  매크로 (data-39's `startFresh()`); a macro failure answers `apply-failed`.
- Either answer starts the record, whose first write replaces the old record.
  After that, every call answers `unavailable` or null.
- A crash with nothing to restore answers 새로 시작 by itself, so the renderer
  shows no dialog and the launch still runs its startup 매크로.
- The check and the claim of an answer happen in one task after the shared offer
  resolves (a NOTE), so a summary, a restore, and a fresh start that race can't
  both apply. A test races `apply` and `startFresh`.

### 켤 때 화면 출력 (`outputs/launch.ts`)

Once the settings are read and `preferences.showOnLaunch` (the current field;
the rename is M4) is on, every saved screen that can show output gets
`output.set` on, in one transaction. A normal launch runs it at once; after a
crash only 새로 시작 runs it. It never throws.

### Channels and wiring

`registerRecoveryChannels` answers the three channels, parses `recovery:apply`
with D1c's schema, refuses a malformed answer as `invalid-selection`, and never
rejects. `index.ts` builds the controller after the macros (a NOTE: after the
overlays, so the store has its settings reader before `output.set`), hands it
the record writer and `macros.startFresh`, starts it, and removes the channels
in the shutdown before the last record write is awaited. `dispatchLogged` and
the new `dispatchBatched` now return whether the state changed; existing callers
ignore it.

## Changed files

- `src/main/live/recovery/plan.ts` and its test: the planner and the Look.
- `src/main/live/recovery/controller.ts` and its test: launch decisions and the
  three answers, run through a real `LiveStore` with the overlay settings.
- `src/main/live/recovery/channels.ts` and its test: the IPC handlers.
- `src/main/live/testing/recovery.ts`: a service, a song item, and record
  fixtures (the hymn fixture of the store tests, public domain).
- `src/main/live/store.ts` and its test: `dispatchBatched` and the change
  result.
- `src/main/outputs/launch.ts`, `savedScreens.ts`, and the launch test.
- `src/main/index.ts` and `index.wiring.test.ts`: the controller and channel
  wiring.

## Changes outside my paths

None. The planner reads data's `songTiles` and the content store's `service` and
`song` through a narrow port without changing them.

## Checks run

| Command or test                                                                  | Result                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                                              | Pass                                     |
| `npx vitest run --no-fsModuleCache` on the recovery, store, launch, wiring tests | Pass                                     |
| `npx eslint` and `npx prettier --check` on the changed files                     | Pass                                     |
| Mutation checks (`.llp/output-30/mutations.log` in the worktree)                 | 23 mutations, all fail a test            |
| `npm run verify`                                                                 | GitHub CI only (see the request message) |

No local Electron, visible window, soak, or memory run.

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI, see the request message)
- [x] `npm run format:check` passes (changed files)
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema (the record
      with data-42's parser, the answer with D1c's)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered IPC handler is removed on shutdown
- [x] Caches and lists have size caps (row and command counts follow the live
      caps; transactions hold at most 256 commands)
- [x] An exception in the output path doesn't stop the output (handlers never
      reject; a failed restore leaves the last good state)
- [x] Only what's needed re-renders (no renderer change)
- [x] The clean code rules and comment rules in `CLAUDE.md` hold
- [ ] The change is small and focused: about 650 lines of code and 1,000 of
      tests; split on request (for example 켤 때 화면 출력 alone)

## Decisions I made (for the lead to confirm)

1. Restore through the existing commands instead of writing recorded overlay
   values into the state, so current settings decide what still exists and the
   slices keep their checks. 소품 therefore show their current saved content.
2. The 슬라이드 comes back as captured (spec-41); the summary still needs the
   song item, found in any service, for the title and the count.
3. A background alone, without a live 슬라이드, has no row in D1c's contract, so
   it isn't offered.
4. The Look is applied with any 복구 answer, before the rows, and not with 새로
   시작.
5. 새로 시작 starts from the launch state as it is; it doesn't clear anything,
   because nothing but F1 to F7 can change the output while the dialog is open.
6. A record with nothing to restore launches normally by itself (spec 08,
   proposal), including the startup 매크로.

## Shared contract change requests

None.

## Where to look

- `plan.ts`: `messageTargets` and the time left, and `noticeCommands`.
- `controller.ts`: `waiting()` and its callers, the answer claim, and
  `launchFresh`.
- `index.ts`: the controller's place after the overlays and the macros.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex3): Request changes: the planner looked the live 슬라이드
  up only in the record's open service, so a slide from another service was
  hidden.
- Round 2 (d759bde5): reviewer (Codex, codex3) Approve; the round 1 finding is
  fixed with planner and end-to-end regressions. Nit, settled here: the final
  head 1be00b9d passed CI (run 40257498111); the earlier failure at 867bf5fe was
  only the native full screen always-on-top test, which output is investigating
  separately. Lead Approve. Rebased by the lead onto local `main` without
  conflicts; typecheck passes. M3-O8 is complete.

## Team member's reply

Round 1 (codex3, Request changes):

1. [P2] `plan.ts`: fixed in `fbd2563a`. The planner no longer trusts the
   record's `serviceId` alone. It searches the recorded service first and then
   every other service in the content store for the live item (item ids are
   unique across services; a NOTE says why), and the row and the restore use the
   service the item was found in. A record without a `serviceId`, or naming a
   service that is gone, also finds the item now. Regression tests: three
   planner cases (another open service, none, one that is gone) and an end to
   end test of your sequence through the real writer, store, and controller (a
   슬라이드 from service A, open B, change the stage message so the record is
   written again naming B, then `recovery.summary` still offers the 슬라이드
   with service A). All four fail against the previous lookup.

CI note for round 2: run 40255827451 at `867bf5fe` failed only in
`src/main/outputs/fullscreenOrder.electron.test.ts`, the native window test on
the runner (`win.isAlwaysOnTop()` was false after leaving full screen). This
request doesn't touch output windows. The same failure appeared on data's
`feat/data/macro-drop` ten minutes later (run 40256513282), while output-33's
run right after it passed, so it looks intermittent. This commit runs CI again.
