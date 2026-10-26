# Review request: `data-61`

- Team member: data (Codex session)
- Branch: `fix/data/close-write-failure`
- Base commit: `c7912cfa` on `main`
- Related brief: `docs/briefs/data.md`; priority request from the lead for
  M3-C1-1 and M3-C1-2 in QA's m3-check1 smoke report.

## What changed and why

A normal close could lose a memo when replacing the service file failed with
EPERM. The renderer counted an edit accepted into main's memory as flushed; the
disk retry ran only during shutdown, after closing was confirmed. Spec 08
requires failed saves to keep the app open with 저장할 수 없음 and 다시 시도.

The close flush now submits editor work, pending writes and memo drafts, then
calls `app.savePending()`. Main flushes content, settings, media and app config
without disposing them and answers false while any tracked save still waits.
Only a successful disk result permits the renderer's successful flush reply. A
failure or rejected call uses the existing failed-saving dialog and resumes
editing. 다시 시도 repeats the disk flush; main retains the latest memo until it
can be saved. 강제로 닫기 still uses the existing explicit discard path.

The handshake also retains the original webContents reference for cleanup. It no
longer reads `BrowserWindow.webContents` after window destruction, which caused
the M3-C1-2 shutdown log's `Object has been destroyed` error.

## Changed files

- `src/shared/ipc.ts`, `schema/appFlush.ts`, their tests and the fake API:
  additive disk-flush channel, method and boolean reply validation.
- `src/preload/index.ts` and its test: checked invoke and invalid or rejected
  reply handling.
- `src/main/store/register.ts`: non-disposing disk flush and handler cleanup.
- `src/main/store/closeFlush.test.ts`: close handshake with real store and
  temporary files, injecting EPERM at the atomic writer boundary.
- `src/renderer/src/control/controlSession.ts` and its test: wait for disk,
  refuse close on failure, preserve the memo and retry.
- `src/main/windows/controlClose.ts` and its test: safe destroyed-window
  cleanup, including IPC listener release and repeated disposal.

## Changes outside my paths

- `src/renderer/src/control/` (shell): the close preflight must wait for main's
  disk result before reporting success.
- `src/main/windows/` (output): prevent the destroyed-window cleanup error.

## Shared contract changes

Additive `app:save-pending`, exposed as `LlpApi.app.savePending()` returning a
checked boolean. No payload, paths, IDs or lists cross this channel.
`app:flush-progress` carries the existing bounded flush request ID once a second
while the control window remains responsive. Main accepts it only from that
window and only for its pending request. Existing flush-request, flush-done and
force-close contracts remain compatible.

## Round 1 checks

| Check                                       | Result                                           |
| ------------------------------------------- | ------------------------------------------------ |
| `npm run typecheck`                         | Pass                                             |
| Targeted Vitest with `--no-fsModuleCache`   | Pass: 172 tests in nine files                    |
| ESLint on changed TypeScript files          | Pass                                             |
| `npm run format` and `npm run format:check` | Pass                                             |
| Full `npm run verify`                       | GitHub CI required before request; URL in report |

The main regression sends a service-item memo update during the close flush and
refuses its atomic write with EPERM. It checks that the handshake keeps the
window open, main retains the newest memo, and the file retains the old memo.
After writes recover, retry closes only after the newest memo reaches disk. The
renderer regression types an unsent memo, checks disk flush occurs after its
content edit, keeps the failed view and editing available, and permits closing
after retry. A rejected disk IPC also refuses closing.

The renderer regression fails against `main`'s `ControlSession` at `c7912cfa`:
the close flush reports success and leaves its view hidden despite the failed
disk-save response. The fixed source was restored after this negative check.

No native window was opened. The EPERM test injects the atomic writer's failure
result; QA's actual Windows file handle reproduction remains the native check.
The five-second unresponsive-renderer bound now measures silence since the last
matching progress message (spec 08); main's slow disk work no longer counts as a
frozen renderer while the renderer continues answering.

## Quality checklist

- [x] Every bug fix has regression tests.
- [x] IPC results are schema checked; no new unbounded collections.
- [x] No new dependencies, unsafe assertions or output-state changes.
- [x] Added handler is removed on disposal.
- [x] Comments follow the repository rules.
- [ ] GitHub full verify is green before the request is sent.

## Decisions I made

Use a non-disposing disk preflight so failed saves keep the application and its
in-memory documents available for retry. Existing renderer delivery semantics
remain unchanged for edits outside the close preflight.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex4): Request changes: awaiting the disk flush used up the
  five-second renderer deadline, so enough locked files could still close the
  window and drop edits (P1), and app-config write failures never counted as
  save failures (P2).
- Round 1 second review (Gemini 4 Argon, gem1): Approve, no findings.
- Round 2 (0ab4a7a1): reviewer (Codex, codex4) Approve. Lead Approve after
  reading the close path: main writes every accepted edit to disk before the
  close goes on and answers false while any file is unsaved, a renderer that is
  still working sends progress that re-arms the deadline (a frozen one still
  times out), the 저장 중 dialog keeps 강제로 닫기 as the only way to drop an
  edit, and every listener is released. Fixes qa's M3-C1-1 (major) and M3-C1-2
  (minor) from the m3-check1 smoke run. Fast-forward onto local `main`;
  typecheck passes.

## Team member's reply

1. P1: the control window now reports progress immediately and every second
   while submitting edits and waiting for disk. Main rearms the five-second
   silence bound only for the current request ID from that window. An alive
   window waiting on slow disk writes stays open; a renderer whose progress
   stops still reaches the bounded no-reply outcome. The interval stops on
   completion and disposal. A main persistence regression holds a failed service
   retry for ten seconds, checks that the window and latest memo remain, then
   fails it and saves the memo after recovery and retry. Tests also reject
   progress from another sender, a stale ID or malformed input.
2. P2: `AppConfigFile` retains whether its current configuration is dirty,
   retries failed writes on flush and exposes a boolean `savePending` result.
   The main preflight includes that result, so an app.json EPERM keeps close
   refused. A subsequent change supersedes the failed snapshot. Unit tests cover
   repeated failure, a newer zoom setting and recovery; the main close
   regression also locks app.json, keeps the window open and closes only after
   retry saves that configuration.
3. The lead reported that the Argon second review found no further issues.

## Round 2 checks

The slow-save regression fails against round 1's `ControlClose`: the window is
already destroyed before the disk refusal arrives. The round 2 source was
restored after that negative check.

| Check                                       | Result                                    |
| ------------------------------------------- | ----------------------------------------- |
| Targeted Vitest with `--no-fsModuleCache`   | Pass: 207 tests in 11 files               |
| `npm run typecheck`                         | Pass                                      |
| ESLint on changed TypeScript files          | Pass                                      |
| `npm run format` and `npm run format:check` | Pass                                      |
| Full `npm run verify`                       | GitHub CI on round 2 head, URL in request |
