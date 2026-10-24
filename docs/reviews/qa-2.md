# Review request: `qa-2`

- Team member: `qa`
- Branch: `docs/qa/m2-plan`, stacked on `docs/qa/m1-plan` (`qa-1`)
- Base commit (`main`): `8b5edaa`
- Last commit: see the commit that adds this file
- Related brief: `docs/briefs/qa.md` (task 6)

## What changed and why

This change adds the M2 test plan, `docs/qa/m2-plan.md`, so that the lead can
check its coverage before the M2 freeze. No code, configuration, or dependency
changed. It builds on the M1 plan and repeats only what differs.

The plan has:

- The scope (the M2 task table) and what stays in M3 (`docs/PLAN.md` phase 3:
  the recovery dialog, Looks, the 무대 화면 layout, the capture window, 진행
  도구, 퀵 실행, the media strip, Bible, 준비, and 화면 설정).
- Fake monitors: the QA launcher replaces what Electron's `screen` reports with
  offscreen monitors and emits connect and disconnect events, so output windows
  never appear on the user's screen and unplugging needs no cable.
- Three cases that need the user and the real second monitor (K22, X20, SK3).
- Test media that QA makes itself with `MediaRecorder` (a frame counter for loop
  seams), kept outside the repository.
- 121 cases: V (2), F file store (13), L library to 진행 (8), O output windows
  (11), R rendering over a looping video (14), K clears and undo (22), P 진행
  workspace (12), X failure recovery (20), SK soak (6), G gallery (10), U UI
  tests (2), and one M1 regression run.

## Changed files

- `docs/qa/m2-plan.md` (new)
- `docs/reviews/qa-2.md` (new)

## Checks run

| Command or test        | Result                                      |
| ---------------------- | ------------------------------------------- |
| `npm run format:check` | Pass (`npx prettier --check` on both files) |
| `npm run verify`       | To run once before the request is sent      |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Not applicable: documents only. No middle dots or em dashes.

## Decisions I made (for the lead to confirm)

1. **Fake monitors by default, real hardware only with the user.** The launcher
   also turns `setFullScreen(true)` into a resize to the fake monitor, because
   Windows would move a full screen window onto a real monitor.
2. **Undo as the spec says.** K14 expects one level of undo and K15 expects new
   content to end an undo (spec 03, `ClearButton` README). The reducer on `main`
   keeps 20 levels, so these cases may fail unless output changes it.
3. **The recovery record is checked, the dialog isn't.** X15 records what M2
   writes to `recovery\`; the dialog is M3.

## Shared contract change requests

None.

## Where to look

Questions for the lead:

1. **L1.** How does a song get from the library into a 예배 순서 in M2, since
   the 준비 workspace and its adding flows are M3? Name the means at the freeze,
   and L1 uses it.
2. **Cases with the user.** Can you arrange K22, X20, and SK3 with the user
   after the fake-monitor runs?
3. **Notifications in M2.** F10 to F12 and X1 expect notification cards where
   spec 08 has them. The Notification component is an M2 ui task, but nothing in
   M2 says who shows the cards. Are they in M2, or only the component?

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
