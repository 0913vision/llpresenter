# Review request: `output-4`

- Team member: `output`
- Branch: `fix/output/user-data-path`
- Base commit (`main`): `63d0dbc`
- Last commit: the commit that adds this file
- Related brief: `docs/briefs/output.md` (bug from qa, M1-1, minor, dev only)

## Changes outside my paths

None. `src/main/userData.ts` is new, next to `src/main/index.ts`.

## What changed and why

With `LLP_USER_DATA` set to a relative path (for example `D:llp-devqa`),
`app.setPath` threw "Path must be absolute" while the main module loaded, before
the `uncaughtException` handler existed. Electron then showed its error dialog,
and the process kept running with no window, holding the single-instance lock.

- `applyUserDataOverride` (new, `src/main/userData.ts`) checks the value before
  Electron sees it: unset or empty keeps the default folder, a path that isn't
  absolute is refused, and an error from `app.setPath` is caught. It returns the
  problem instead of throwing.
- `src/main/index.ts`: with a problem, the app logs it at error level, flushes
  the log, and exits with code 1. It never asks for the single-instance lock and
  never opens a window, so nothing is left running.

**Quit, not fall back** (the lead left the choice to me): an explicitly set but
unusable folder means the run's isolation is broken. The default folder may
belong to another session or to the real app data, and a silent fallback would
hide the mistake. The log line goes to the default folder's `logs/main.log`, and
to the console in development (`echo` when not packaged).

## Changed files

- `src/main/userData.ts` (new), `src/main/userData.test.ts` (new)
- `src/main/index.ts`, `src/main/index.test.ts` (new)
- `docs/reviews/output-4.md` (new)

## Checks run

On `18b1326`, on `main` at `63d0dbc`.

| Command or test  | Result                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Passed, 5 steps in 209.8 s: typecheck, lint, format check, 23 test files and 194 tests with coverage, build                                                                                                                                                                                                                                                                |
| New tests        | `userData.test.ts`: unset, empty, absolute, three relative forms, and a refused path. `index.test.ts`: loads the real entry with Electron mocked; a relative path and a path Electron refuses both exit with code 1, log the problem, never call `setPath` (relative) or ask for the lock, and never call `dialog.showErrorBox`; a usable path moves the folder and starts |
| The app          | Not started: the entry test covers the module-load path without a window on the user's screen                                                                                                                                                                                                                                                                              |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated (the environment value)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the entry test removes the process
      handlers it adds)
- [x] Caches and lists have size caps (no change)
- [x] An exception in the output path doesn't stop the output (no change)
- [x] Only what's needed re-renders (control window): not touched
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: not relevant

## Decisions I made (for the lead to confirm)

1. Quit with exit code 1 instead of falling back to the default folder (see
   above).

## Shared contract change requests

None.

## Where to look

- `src/main/index.ts`, the last lines: the bad-folder path runs before the
  single-instance lock.
- `src/main/index.test.ts`: how the entry is loaded fresh with Electron mocked,
  and how the process handlers it adds are removed after each test.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Verdicts (recorded by the lead at merge)

- Round 1 (90051d1): lead Approve, and the lead confirms decision 1 (quit with
  exit code 1, because the default folder may belong to another session or to
  the real app data). Reviewer (Codex, codex2) Approve with one nit:
  `src/main/index.test.ts:55` reads the log after the mocked exit, which doesn't
  prove the flush finished before exit; defer the write and check that exit
  waits for it. The nit goes into output's next branch. Rebased by the lead onto
  `main` 044d1fa without conflicts.
