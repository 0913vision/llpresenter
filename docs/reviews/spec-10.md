# Review request: `spec-10`

- Team member: `spec`
- Branch: `docs/spec/wave-b-readiness`, from `main` (not stacked)
- Base commit (`main`): `814781b`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's message of October 25 (spec-10, M3 wave B
  readiness)

## What changed and why

### Round 1

The same check as spec-9, for the wave B requests in
`docs/plans/m3-breakdown.md`: can the owner build and test from the spec without
guessing? Gaps are filled in `docs/spec/`. Edits avoid the lines that spec-5,
spec-7, spec-8, and spec-9 change, except one 06 hunk next to spec-8's test
pattern line (noted below).

| Request | Spec it builds from                                                              | Ready?                                              | Gaps filled here                                                                                                                                                                                                                                                                                                                      |
| ------- | -------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1      | 06 "The 화면 설정 workspace", "Screens"; 10 screens inventory                    | Yes, after this change                              | 06: what the health dot shows; one full screen output per monitor (assigning a used monitor unassigns the other screen); the control monitor isn't offered as a device; an empty or duplicate screen name shows the error ring and reverts.                                                                                           |
| O4      | 03 "Looks", "Drawing text"; 10 lyric style inventory                             | Yes, after this change                              | 03: the scale factor (smaller of width / 1920 and height / 1080, for every px value); the text area from `margin`; the height that `maxLines` allows; word wrapping with `keep-all`; shrink to fit in whole px down to half the style size, never cut; fixed outline and shadow values until entry 26.                                |
| O9a     | 03 "Screens and output windows"; 06; 10 screens inventory                        | Yes, after this change                              | 03: changing method, monitor, or resolution while on moves or resizes the window and keeps the content; a screen switched to 창 opens 960 x 540 on the control monitor.                                                                                                                                                               |
| O9b     | 06 "Output preview", "Display layout"; 03                                        | Yes, after this change                              | 06: the test pattern's layout (seven bars, an 11-step gray ramp, a 2 px border, name and resolution), drawn with the corrections applied; monitor numbers in borderless windows above everything. 03: edge margin m % scales the picture to (100 − 2m) %; the offset moves it in screen pixels; what moves past the edge isn't drawn. |
| S1a     | 04 "예배 순서 panel", "Service list", "장 panel"; 05                             | Yes, after this change                              | 04: in 진행, Ctrl Z stays the clear undo, so a deleted item comes back with 편집 > 실행 취소, which always runs the edit undo. 다음 항목 and 이전 항목 are commands (10), not header buttons.                                                                                                                                         |
| P1      | 05 "라이브러리", "Search" (with spec-9's search rules)                           | Yes, after this change                              | 05: the sort uses the Korean collation with numeric order, so "찬송 2" comes before "찬송 10".                                                                                                                                                                                                                                        |
| P2a     | 05 "Blocks", "이름표 menu", "Managing the 이름표 list"                           | Yes, after this change                              | 05: each song keeps its own undo history while the app runs, up to 100 steps; typing in one block is one step until the cursor leaves or 1 second passes.                                                                                                                                                                             |
| T1a     | 04 "표시 중", "무대", "메시지" (with spec-9's 메시지 rules)                      | Yes                                                 | None beyond spec-9.                                                                                                                                                                                                                                                                                                                   |
| T4a     | 02 "Bible translations" (spec-4, and spec-8's endpoint fix); 04 "Bible passages" | Yes, after this change and the user's source choice | 04: the recent list moves a repeated passage to the front instead of listing it twice; book suggestions are in canonical order, at most 8.                                                                                                                                                                                            |
| D3      | 05 "Text import"; 10 "가져오기" page                                             | Yes, after this change                              | 05: line endings and tabs are normalized; 자동 encoding reads UTF-8 only when the bytes are valid UTF-8; 줄 바꿈 respects stanza breaks, as ProPresenter's import does (S4 p. 90); 기호 splits anywhere and drops empty units; the exact 이름표 line pattern, and an 이름표 line ends the current 장.                                 |

### What still needs a user decision for wave B

The proposals apply until the user decides (`docs/plans/open-decisions.md`), so
no request has to wait, but a later decision changes code.

| Entry | Decision                             | Wave B request it touches | What changes if the user picks another option               |
| ----- | ------------------------------------ | ------------------------- | ----------------------------------------------------------- |
| 4     | Prevent sleep                        | O9a, O1                   | A switch per screen instead of always on.                   |
| 5     | Number of screens                    | O1                        | The screen list gets 화면 추가.                             |
| 6     | Navigating 화면 설정                 | O1                        | The workspace frame.                                        |
| 7     | Transitions                          | O4                        | The fixed transition constant becomes settings.             |
| 8     | Bible text source                    | T4a                       | T4a can't ship its data until the user chooses.             |
| 9     | Bible files in the public repository | T4a                       | Where the converted files live.                             |
| 10    | A style for Bible passages           | O4                        | Bible 장 draw with a 말씀 style instead of the lyric style. |
| 11    | Text import details                  | D3                        | The title and 이름표 rules.                                 |
| 26    | Outline and shadow detail            | O4                        | The fixed outline and shadow values become settings.        |

## Changed files

- `docs/spec/03-output.md`, `04-show.md`, `05-prep.md`, `06-settings.md`
- `docs/reviews/spec-10.md` (new)

## Checks run

| Command or test           | Result                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`          | Pass on base `20ffc86`: typecheck 11.5 s, lint 45.7 s, format:check 128.4 s, test:coverage 150.1 s (98 files, 1014 tests, 1 skipped), build 12.9 s; 348.6 s in all. Then rebased onto `814781b`, which changes no file in `docs/spec/` or `docs/plans/` |
| Middle dots and em dashes | None in the changed files (checked with `grep -c`)                                                                                                                                                                                                      |

## Decisions I made (for the lead to confirm)

1. **Shrink to fit stops at half the style size** and then lets the text run
   past the margins rather than cutting it. Lyrics on screen matter more than
   the margin.
2. **The control monitor isn't offered** as a full screen device, so a misclick
   in 화면 설정 can't cover the control window during a service.
3. **The edit undo in 진행** is the 편집 menu's 실행 취소, because Ctrl Z there
   belongs to the clear undo (spec-5).
4. **Merge note:** the new 06 test pattern bullet sits right after the line that
   spec-8 rewrites; if spec-8 merges first, I resolve that one hunk when I
   rebase.

## Where to look

- 03 "Drawing text", which O4's tests come from.
- 03 and 06 for the correction values, which O9b's tests come from.
