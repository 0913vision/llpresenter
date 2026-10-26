Review range: `82f52b18...feat/spec/output-notices`

# Review request: `spec-45`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/output-notices`
- Base commit: `82f52b18`, main with spec-44 merged
- Review round: 2
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

## Round 2 response

1. **Unresolved warnings stay after their actions.** The session closes a card
   when one of its buttons is pressed, so each warning's actions now show the
   card again right after they run while the warning still holds (the current
   card from the warning store). A rescan or retry that changes nothing leaves
   the warning visible; one that works brings a status push that replaces or
   closes it. 창 보기 keeps the card too, since the monitor is still missing.
   Tests: an unsuccessful 모니터 다시 찾기 and an unsuccessful 다시 시도 both
   leave their cards; 창 보기 leaves the lost monitor card.
2. **Obsolete warnings close.** A screen whose placement becomes `window`
   (window or capture mode) closes its lost monitor card, from a missing monitor
   and from the output-off variant; a screen that leaves the status closes both
   of its cards. Unit tests for each transition, and a mounted test for the mode
   switch and the removal.
3. **Reopening a closed warning.** I departed from the finding's wording on
   purpose: the finding asks for the status bar text to reopen the card, as spec
   08 said, but the design system's StatusBar README says nothing in the status
   bar can be clicked or focused, and the design system wins on UI (`CLAUDE.md`,
   "Sources of truth"). A pointer-only target would also leave keyboard users
   without a path. The lead decided (October 26) that the menu bar's 출력 menu
   lists one item per screen with an unresolved warning, "무대 화면 경고 보기"
   (an item that ends in a verb, as the Menu README asks), which shows that
   screen's warning cards again; with no unresolved warning there is no item.
   Spec 08 now says so, with the decision note. The active warnings live in
   `state/outputWarnings.ts` (kept on a warning, dropped when it resolves or
   becomes obsolete). The 출력 menu didn't open yet, so this adds its smallest
   version: the three screens' output on and off with check marks (spec 01's
   first items) and the warning items. The Looks list stays a TODO. Tests:
   closing the card, reopening it from the menu, and the item disappearing once
   the monitor is back; store tests for keeping, dropping, and listing each
   screen once.

Private helper comments in `outputNotices.ts` are NOTE comments now, as the
spec-43 review asked of private TSDoc. The lead's spec-43 nit is also here: the
private `measuredPanel()` test helper in `ShowToolsPanel.test.tsx` has a NOTE
instead of TSDoc.

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

None. `src/renderer/src/control/notifications/`, `App.tsx`,
`src/renderer/src/shell/MenuBar.tsx`,
`src/renderer/src/state/outputWarnings.ts`, and spec 08 are in shell's and my
paths.

## Validation

| Command or test                                        | Result                 |
| ------------------------------------------------------ | ---------------------- |
| `npm run typecheck`                                    | Pass                   |
| `npx vitest run --no-fsModuleCache src/renderer`       | Pass, 1,639 tests      |
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
