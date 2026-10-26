# Review request: `tools-7`

- Team member: tools
- Branch: `fix/tools/quick-menu-race`
- Base: local `main` at `0f868ec2`, including approved tools-6.
- Brief: `docs/briefs/tools.md`. Priority CI stabilization before T1a.
- Final head and exact-head CI are in the report.

## What changed and why

`QuickEditing.test.tsx` sometimes clicked 퀵 실행 추가 before its settings
document finished loading. The button already exists during loading, so
`findByRole` does not wait for it to become enabled. Its disabled click is
correctly ignored, leaving the menu closed and making the later menu-item query
fail. Run `40289709621` has the matching closed-menu DOM.

All add-menu interactions in this file now share a helper that waits for the
button to become enabled, clicks it once, and waits for the menu. Current-source
actions still wait separately for the asynchronous source lookup to finish.
Submenu tests also wait for their target group to finish loading before
clicking. There are no fixed sleeps, retries of clicks, or increased timeouts.

A deferred initial settings read reproduces the closed-menu failure before the
readiness wait and passes after it. The regression holds the read pending,
checks the disabled button and absent menu, then resolves the document and
checks that the helper opens the menu.

## Changed files and changes outside my paths

Only the owned quick editing test and this review document change. No product,
shared contract, dependency or output behavior changes.

## Checks and quality

- Typecheck and changed-file ESLint passed.
- Twenty consecutive complete-file runs passed (22 tests each, 440 total). The
  coverage-mode result after rebase is in the report.
- Repository format check and exact-head GitHub verify are in the report.
- No new comments, subscriptions, timers, fixtures with random IDs, or caches.
  New `/**` comments were audited before requesting review.
- No full local verify or app launch.

## Verdicts (recorded by the lead at merge)

- Round 1 (ae051d08): reviewer (Codex) Approve. Lead Approve; this fixes the
  `QuickEditing.test.tsx` race that failed CI on branches based on `main` (run
  40289709621), so the check build's verify doesn't trip on it. Fast-forward or
  rebase onto local `main` without conflicts; typecheck passes.

## Team member's reply
