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
checked boolean. No payload, paths, IDs or lists cross this channel. Existing
flush-request, flush-done and force-close contracts remain compatible.

## Checks run

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
The five-second unresponsive-renderer bound is unchanged (spec 08).

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
