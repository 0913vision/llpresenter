# Review request: `qa-2`

- Team member: `qa`
- Branch: `docs/qa/m2-plan`
- Base commit (`main`): `4aa7901`
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
- `docs/qa/m1-plan.md`: D26 expects the 매크로 action defaults the lead decided
  on 2026-10-25 (a missing screen, mode, or operation takes its default on read;
  레이어 지우기 also takes one 소품)

## Checks run

| Command or test        | Result                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `npm run format:check` | Pass                                                           |
| `npm run verify`       | Pass, exit 0, "verify passed: 5 steps in 165.1 s" on `e150788` |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

Not applicable: documents only. No middle dots or em dashes.

## Decisions I made (for the lead to confirm)

1. **Fake monitors by default, real hardware only with the user.** The launcher
   also turns `setFullScreen(true)` into a resize to the fake monitor, because
   Windows would move a full screen window onto a real monitor.
2. **Undo as the spec says.** K14 expects one level of undo and K15 expects new
   content to end an undo (spec 03, `ClearButton` README). The reducer on `main`
   keeps 20 levels, so these cases may fail unless output changes it.
3. **The recovery record is required, the dialog isn't.** Since round 2, X15
   fails a missing or stale `recovery\live.json` (phase 2 requires it); the
   dialog is M3.

## Shared contract change requests

None.

## Where to look

The lead answered three questions before this request, and the plan follows the
answers:

1. In M2, a song reaches a 예배 순서 through a service file prepared on disk, so
   the plan describes that fixture ("Fixture") and L1 starts from it.
2. The lead arranges K22, X20, and SK3 with the user at the M2 freeze. The steps
   for the user are in Korean under "Cases with the user".
3. M2 ships the `Notification` component and the main-process events, not the
   notification host. Cases that expect a card check the event, and the card
   part is marked "(card: M3)"; X3 moves to M3.

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

Round 1 (Codex 0:6, Request changes). All six findings are addressed in round 2:

1. **Safe launches.** Agreed. A new section, "Safe launching", says how every
   run starts Electron: the app through the QA launcher (invisible windows,
   recorded dialog, focus, full screen, and always-on-top calls), the gallery
   with `npm run gallery` and the invisible viewer, and soak runs through the
   launcher with the `LLP_SOAK_*` variables, judged with
   `npm run soak -- --minutes <n> --judge`. It names the commands QA never runs
   (`npm run soak` without `--judge`, `npm run dev`, `electron-vite dev`,
   `electron .`), and only K22, X20, and SK3 show windows. SK1 and SK2 use it.
   The M1 plan's P-gallery and safety rule, which the M2 plan inherits, now say
   the same; the fake monitors sit right of the real one, where the windows stay
   invisible.
2. **P2 and P3 against spec 10.** Agreed. P2 follows focus precedence rule 5
   (the grid keeps ↑, ↓, and Enter; the list also Home and End; ←, →, Space,
   Page Up, and Page Down stay live keys). P3 covers →, Space, Page Down, ←, and
   Page Up, the last 장 stopping (멈춤), opening another item before →, held
   keys, the search field, click and Tab focus on a toolbar button, and Ctrl ↓,
   Ctrl ↑, and Ctrl L.
3. **F6 and the autosave delay.** Agreed. F6 now watches the folder and kills at
   three real write stages (the temporary file appearing, at full size, and
   right after the rename), and checks the next start.
4. **Numbers without a rule.** Agreed. F13 keeps "no gap in the frame record"
   and records frames over 50 ms and the counts; SK2 records the median fps (the
   judge's warning under 58) and long frames; SK6 keeps the `StatusBar` README
   switching rules and records the fps difference.
5. **States M2 can't set.** Agreed. K1 to K7 assert each layer's content first
   and name the fixtures for lyrics, media, and 메시지; F4, F5, and F7 are
   blocked, never passed, unless the build adds a way to fill 소품, 오디오, or
   공지. O3 asserts that a 무대 화면 screen exists (from a `screens.json`
   fixture if the build reads one) and, without it, blocks O3, X5, and the 무대
   화면 part of SK2.
6. **Recovery record.** Agreed. X15 now requires `recovery\live.json` with the
   spec 02 fields for what M2 outputs, updated within about 1 s of each change,
   and `session.lock` while running, kept after a kill, and gone after a clean
   quit. Missing or stale fails. The dialog stays M3.
