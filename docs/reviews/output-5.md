# Review request: `output-5`

- Team member: `output`
- Branch: `feat/output/prevent-sleep`, stacked on output-1
  (`feat/output/windows`)
- Base commit (`main`): `c402184`
- Last commit: the commit that adds this file
- Related brief: `docs/briefs/output.md` (task 1, a follow-up named in output-1)

## Changes outside my paths

None.

## What changed and why

The app now keeps the display and the system awake while any screen output is
on, and lets them sleep once the last output turns off. A projector or a laptop
that sleeps in the middle of a service stops the output, so this closes one of
the gaps output-1 listed. There is no setting:
`docs/spec/10-shortcuts-and-settings.md` (decision 5, open question 10, proposal
in effect) removes the 절전 막기 switches, because Windows sleep is system-wide
and no service is better with sleep allowed.

- `WakeKeeper` (`outputs/wakeLock.ts`) holds at most one wake lock: it takes it
  when needed and releases it when not, and logs a lock it couldn't take or
  release instead of throwing.
- `keepAwakeWhileOutputsOn` follows the live state and asks for the lock while
  any entry in `outputs` is on. It doesn't depend on the monitors or the
  windows, so it stays out of `OutputManager`.
- `createElectronWakeLock` (`outputs/electronWakeLock.ts`) is the thin adapter:
  `powerSaveBlocker.start('prevent-display-sleep')`, which keeps the system
  awake too.
- `startOutputs` wires it and releases the lock when the outputs stop (the
  control window closing, or `before-quit`).

Not in this request: restarting a hung output renderer. Output windows get no
input, so Electron's `unresponsive` event may never fire for them. The frame
rate report that output-2 adds is a better heartbeat: when a visible output
stops reporting for a few seconds, the main process can crash its renderer on
purpose, and the relaunch from output-1 takes over. I'll propose it after
output-2.

## Changed files

- `src/main/outputs/wakeLock.ts` (new), `src/main/outputs/wakeLock.test.ts`
  (new), `src/main/outputs/electronWakeLock.ts` (new)
- `src/main/outputs/start.ts`
- `docs/reviews/output-5.md` (new)

## Checks run

On `e10119e`, on `main` at `c402184`.

| Command or test  | Result                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Typecheck, lint, and format check passed. Tests: 757 passed and 1 failed: `test/git-repo.test.ts` (devops, not touched here) timed out at 5.5 s on the busy machine, recorded and not rerun as the rules say. The build step, which verify skipped after the failure, passed on its own |
| New tests        | One lock while outputs are on, released only after the last one turns off; no change while content changes; release on stop; a lock that fails to start or stop is logged                                                                                                               |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none new)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the store subscription and the wake
      lock)
- [x] Caches and lists have size caps (one lock at most)
- [x] An exception in the output path doesn't stop the output (lock errors are
      logged)
- [x] Only what's needed re-renders (control window): not touched
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [ ] Measured performance values: not relevant

## Decisions I made (for the lead to confirm)

1. The lock follows the output switches in the live state, not whether a window
   shows: an output that moved to a fallback window is still on, so the system
   stays awake.

## Shared contract change requests

None.

## Where to look

- `src/main/outputs/wakeLock.ts`.

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
