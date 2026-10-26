Review range: `feat/spec/output-actions...feat/spec/output-notices`

# Review request: `spec-45`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/output-notices`
- Base: spec-44 (`feat/spec/output-actions`), stacked until its approval
- Review round: 1
- Task: M3-S2a part 2, the output notifications of spec 08
- Code owner: shell (`src/renderer/src/control/notifications/` and `App.tsx`)

## What changed and why

ui's notification stack already follows spec 08's stack rules (top right, at
most three cards, information closing after six seconds with a hold, replace by
cause, no focus), and `ControlSession` is the app's one notice list. The output
status push existed with no consumer. This request turns status updates into the
version 1 output cards:

- **Lost monitor** (spec 08 "Lost monitor", spec 03): when a screen's placement
  becomes `monitorMissing`, the warning "무대 모니터 연결 끊김" shows with the
  detail "모니터 3 → 창으로 표시 중" and the actions 모니터 다시 찾기 and 창
  보기 (spec-44's `findMonitors` and `showWindow`). When the screen is full
  screen again, the card turns into the information "무대 모니터 다시 연결됨",
  which closes after six seconds. The key is `screen:<id>`, so the second card
  replaces the first.
- **Output turned off while the monitor is missing** (spec 03, "turn that
  screen's output off and show the same warning"): the warning stays, with
  "모니터 2 → 출력 꺼짐" and only 모니터 다시 찾기. A later full screen from off
  clears the card.
- **Restart limit** (spec 08 "The restart limit"): when a renderer becomes
  `limited`, the warning "본 화면 출력 창을 다시 띄울 수 없음" shows with "빈
  화면으로 표시 중" and 다시 시도 (`output.retry`); when it runs again, the
  information "본 화면 출력 창 다시 띄움" replaces it. Restarts below the limit
  stay silent, as spec 08 says. The key is `output-window:<id>`.

`outputNoticeChanges` is a pure function from the previous and next statuses to
cards to show or dismiss. `useOutputNotices` subscribes to the status push,
reads the status once when no push came first (so a monitor already missing at
launch warns), stamps cards with `noticeTime()`, and releases the listener on
unmount. A card button runs its action and closes the card, through
`ControlSession`.

The missing media marks that S2a also lists already exist from S1a and S1b: the
예배 순서 row problems and the slide panel's amber background control with 다시
연결. The file and save problem cards follow as spec-46 on data-46's problem
event channel (agreed with data).

## Decisions I made (for the lead to confirm)

1. Only the built-in screens (본 화면, 무대, 방송 자막) get cards, named from
   `shell/screens.ts`, because the screen settings don't reach the control
   window yet (a TODO marks it). This also avoids a second card for a screen's
   alias key, since the status lists each screen under its id and its aliases.
2. The output-off variant of the lost monitor card ("출력 꺼짐", one action) is
   my reading of spec 03's "same warning"; 창 보기 has no window to show then.
3. The restart limit cards use the `warning` icon and the reconnect and reopened
   cards the `monitor` icon, as the gallery's reconnect card does; spec 08 names
   no icon for the limit.

## Changes outside my paths

None. `src/renderer/src/control/notifications/` and `App.tsx` are shell's.

## Validation

| Command or test                                        | Result                 |
| ------------------------------------------------------ | ---------------------- |
| `npm run typecheck`                                    | Pass                   |
| `npx vitest run --no-fsModuleCache src/renderer`       | Pass                   |
| `npx eslint --max-warnings 0 src/renderer/src/control` | Pass                   |
| `npx prettier --check` on the changed files            | Pass                   |
| GitHub CI (`npm run verify`)                           | In the request message |

Tests: every transition rule (lost, back, off while missing, stale clear, first
status, no monitor, silent changes, unknown screens, limit, reopened,
restarting, both at once), and the mounted app: the stage card with both actions
calling main, the information card closing at six seconds with fake timers, a
monitor missing at launch, 다시 시도, at most three cards, and the listener
released on unmount.

No Electron process, visible window, soak, or memory measurement was started.
