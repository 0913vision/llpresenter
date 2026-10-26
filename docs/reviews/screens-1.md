# Review request: `screens-1`

- Team member: `screens`
- Branch: `feat/screens/workspace-frame`
- Base commit (`main`): `4fe8bab3`
- Last commit: see the request line
- Related brief: `docs/briefs/screens.md`

## What changed and why

M3-O1 part 1: the 화면 설정 workspace frame and the screen list.

- The left column of 화면 설정 stacks three lists: 화면, Look, and 무대 배치
  (spec 06, open question 23). One selection store holds the selected row of all
  three, so choosing a row in one list clears it in the others. The center and
  right columns keep their empty panels until parts 2 to 4.
- The 화면 list shows the 청중 and 무대 groups from `screens.json`. Each row has
  the monitor or capture icon, the name, the target (`모니터 2`, `창`,
  `캡처용 창`, `NDI`, or `모니터 미지정`), and the health dot of spec 06: the
  `ok` dot while the output is on and healthy, an amber dot with the reason in a
  tooltip while it has a problem, and no dot while it is off.
- The row in use in the Look and 무대 배치 lists carries the design system's
  LIVE badge and live bar instead of a "사용 중" chip.
- Documents arrive through `settings.get` and `settings.subscribe` and keep the
  newest revision. Statuses arrive through `output.getStatus` and
  `output.subscribeStatus`. Both release their subscriptions on unmount, and a
  failed read is logged and reported as a notice.

## Changed files

- `src/renderer/src/screens/`: `ScreenList.tsx`, `ChoiceList.tsx`,
  `LookLists.tsx`, `screenRows.ts`, `choices.ts`, `selection.ts`,
  `useSettingsDocument.ts`, `useOutputStatuses.ts`, and their tests, plus
  `testing/documents.ts` (invented fixtures).
- Changes outside my paths: `src/renderer/src/shell/Workspace.tsx` (shell's
  path). The screens workspace panels are now 화면, Look, and 무대 배치 in the
  left column, and `screensPanelParts` mounts the three lists. Nothing else
  changed there.

## Checks run

| Command or test                                  | Result                    |
| ------------------------------------------------ | ------------------------- |
| `npm run typecheck`                              | Passes (after the rebase) |
| `npx eslint` on the screens folder and Workspace | No findings               |
| `npx vitest run` on the screens and Workspace    | Pass (47 tests)           |
| `npm run format:check`                           | Prettier ran on my files  |
| GitHub CI                                        | See the request line      |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [ ] `npm run verify` passes (GitHub CI run in the request)
- [x] `npm run format:check` passes on my files
- [x] Every new behavior has unit tests
- [x] Values from outside the process are validated with a schema (the settings
      and status replies are already parsed by the preload bridge)
- [x] No `any`, no bypassing type assertions, and no `!`
- [x] Every registered subscription is released (tested)
- [x] The lists are as long as the files; the file caps are data's
- [x] Not in the output path
- [x] Only what's needed re-renders: each list reads its own selection and
      documents
- [x] The clean code rules hold
- [x] Comments are TSDoc on exports only
- [x] Modern language features used
- [x] The change is focused, but larger than 400 to 600 lines (about 520 lines
      of code and 470 of tests and fixtures)
- [ ] Measured performance values: not relevant

## Decisions I made (for the lead to confirm)

1. Open question 23: the item in use is marked with `ListRow`'s `live` mark
   (LIVE badge and bar). The Look in use is the live state's `lookId`, or the
   saved `current`. The stage layouts in use are the layouts that this Look
   gives the 무대 screens, the base layout of spec 03.
2. The screen target for full screen is the monitor number the output last
   showed on (`status.monitor`), else the saved `display.number`, else
   `모니터 미지정`.
3. A screen with its output on but no status yet shows no dot, because the dot
   must not claim health that nothing has reported.
4. The selection store is a module-level store, so the selected row stays when
   the operator leaves and returns to 화면 설정.
5. The three lists each read their own documents, so `screens` and `looks` have
   more than one subscription. Each is released on unmount.

## Shared contract change requests

None.

## Where to look

- `screenRows.ts` for the health and target rules.
- `useSettingsDocument.ts` for the newest-revision rule and the cleanup.
- `ScreensWorkspace.test.tsx` for the mounted behavior.
- `Workspace.tsx` for the one shell change.

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
