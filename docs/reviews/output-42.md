# Review request: `output-42`

- Team member: `output`
- Branch: `feat/output/pattern-guard`
- Base and range: in the review request message.
- Scope: the 테스트 패턴 safety net the lead asked for after screens-4: main
  hides every pattern when the control window closes, crashes, or loads its page
  again, and hides a screen's pattern when its output turns off, so a pattern
  can never stay on a projector during a service.
- GitHub CI of the head commit: the URL and result are in the review request
  message.

## What changed and why

- `guardTestPatterns` (`src/main/outputs/testPatternGuard.ts`, new) watches the
  control window: `closed`, `render-process-gone`, and a main-frame,
  cross-document `did-start-navigation` (a reload). On any of them it sends
  `screen.testPattern.set` off for each screen that shows the pattern, through
  `dispatchLogged`, and warns once with the reason. In-page and subframe
  navigations leave the patterns alone. It returns a release that removes its
  listeners, and skips the web contents' listeners once they are destroyed.
- `startOutputs` starts the guard with the control window it already gets and
  releases it with the outputs.
- The outputs slice: turning a screen's output off (or dropping a removed
  screen's flags) also drops that screen's pattern, in the same state change.
  Turning an output on, or an `output.set` that changes nothing, keeps it, so
  화면 설정 can still show the pattern on a screen before its output turns on.
- Spec 06: the safety net, marked "(lead decision, October 26)".

## Changed files

- `src/main/outputs/testPatternGuard.ts` (new) and its test.
- `src/main/outputs/start.ts` and its test (the electron mock's control window
  is an event emitter now).
- `src/main/live/slices/outputs.ts` and `src/main/live/testPattern.test.ts`.
- `docs/spec/06-settings.md`.

## Changes outside my paths

None.

## Checks run

| Command or test                                                  | Result                                   |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `npm run typecheck`                                              | Pass                                     |
| `npx vitest run src/main/outputs src/main/live`                  | Pass, 416 tests (the native test skips)  |
| `npx eslint` and `npx prettier --check` on the changed files     | Pass                                     |
| Mutation checks (`.llp/output-42/mutations.log` in the worktree) | 11 mutations, all fail a test            |
| `npm run verify`                                                 | GitHub CI only (see the request message) |

Tests: each way the control window goes away hides both patterns and warns once;
in-page and subframe navigations don't; the release removes every listener, also
after the web contents are destroyed; the wiring in `startOutputs` hides a
pattern on close and stops after the outputs stop; and an output turned off
hides only its own pattern, while on, or a no-op, keeps it.

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

1. A reload counts as a main-frame navigation to another document; the control
   window's in-page route changes don't hide anything.
2. An `output.set` off for a screen whose output is already off keeps its
   pattern, since nothing turned off.

## Shared contract change requests

None.

## Where to look

- `src/main/outputs/testPatternGuard.ts`.
- `src/main/live/slices/outputs.ts`: the dropped pattern.

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
