# Review request: `output-50`

- Team member: `output`
- Branch: `fix/output/quit-after-pattern-guard`
- Base, head, review range and GitHub CI: in the request message.
- Scope: urgent major M3-C2-1, normal quit after enabling and disabling outputs
  leaves output windows and the Electron process alive.

## What changed and why

QA reproduced the failure on `m3-check2` at `ca4b745c`. The shutdown stack
reported `TypeError: Object has been destroyed`: the pattern guard's release
read the destroyed control BrowserWindow's `webContents` getter. That exception
escaped the stop-callback loop before `outputs.dispose()`, leaving hidden output
pages alive. The lead assigned this fix before the next check build.

- `guardTestPatterns` checks the control before setup, captures web contents
  once, and uses that reference for subscriptions and release. Release checks
  the owner and contents destruction flags before touching native contents. The
  control's ordinary event listener still releases.
- Every output cleanup callback has its own logged exception boundary.
  Output-manager, screen-source and display-registry disposal run in the same
  protected sequence, so an earlier callback cannot skip them. Shutdown stays
  idempotent and preserves cleanup order.

Evidence read without editing:
`D:\programming\2020-\pp\.claude\worktrees\qa\docs\qa\m3-check\smoke.md`,
"Check2 urgent finding: M3-C2-1".

## Changed files

- `src/main/outputs/testPatternGuard.ts` and its test.
- `src/main/outputs/start.ts` and its test.
- This review document. Changes outside my paths: none.

## Checks run

- Three new regressions failed before the fix: release after owner destruction,
  setup with an already destroyed owner, and a throwing stop callback after
  output on/off. The fake getter throws like Electron's destroyed-window getter.
- Targeted output/shutdown/main-wiring tests, typecheck, own-file ESLint and
  formatting: see request message.
- Full `npm run verify`: GitHub CI only, URL/result in the request message.
- No local Electron or visible/native windows were started. QA's real quit
  retest belongs on the check build.

## Quality checklist

- [x] Destroyed owner never causes a second web-contents getter read
- [x] A throwing early release still destroys cached output windows
- [x] Later screen, display and IPC cleanup continues; errors are logged
- [x] Stop remains idempotent; no new resource or shared contract
- [ ] GitHub head verify passes (see request message)

## Verdicts (recorded by the lead at merge)

- Round 1 (6181c465): reviewer (Codex) Approve. Lead Approve after reading both
  files: the pattern guard captures the web contents once and checks
  `control.isDestroyed()` before touching it, and every stop callback of
  `startOutputs` runs in its own try and catch, with outputs, screens, and
  displays disposed as ordinary stop callbacks, so a failing release can no
  longer keep the outputs and the process alive. Fixes qa's M3-C2-1 (major) from
  the m3-check2 smoke run, which came from output-42. Rebased by the lead onto
  local `main` without conflicts; typecheck passes.

## Team member's reply

1.
