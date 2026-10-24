# Review request: `spec-7`

- Team member: `spec`
- Branch: `docs/spec/failure-and-previews`, from `main` (not stacked)
- Base commit (`main`): `8273192`
- Shared files changed: none
- Last commit: see the commit that adds this file
- Related request: the lead's message of October 25 (spec-7, three parts)

## What changed and why

### Round 2

Codex (codex3) requested changes:

1. **Preview during a restart (finding 1).** 08 had the preview draw the live
   state while the audience saw the empty picture, against 04's rule. Now one
   behavior: while a screen's output window restarts or is held at the restart
   limit, the window and its preview both show the empty picture; both draw the
   live content again once the page has loaded the output state. 04 states the
   rule and its one exception (an output the operator turned off keeps its
   preview picture).
2. **방송 자막 layers (finding 2).** 04 no longer says the 방송 자막 preview
   never shows 공지, 소품, or 메시지. The default Look hides them there (03); a
   Look that turns them on shows them on the screen and in its preview.
3. **One timer per screen (nit).** 08: each screen has at most one pending
   attempt and one attempt in progress; 다시 시도 or turning the output on
   cancels the pending cool-down and starts an attempt at once.
4. **Key field order (nit).** 10 "Reserved keys" now lists the checks in order:
   Esc cancels, Backspace alone removes the shortcut, Tab and Shift Tab end the
   recording and move focus (no keyboard trap), then other reserved keys are
   refused with the tooltip. Those three rows show "None" in the Tooltip column.
   "Matching keys" says the same for keys with an empty `code`.

### Round 1

The lead asked for three changes.

1. **Reserved key tooltips (`10-shortcuts-and-settings.md`, "Reserved keys").**
   The table gets a Tooltip column with a Korean phrase for every reserved key,
   in the form "(용도)에 쓰는 키" that the lead approved, like the `KeyCap`
   conflict tooltip "(명령)과 겹침": "포커스 이동에 쓰는 키", "취소에 쓰는 키",
   "확인과 실행에 쓰는 키", "단축키 지우기에 쓰는 키", "메뉴 막대에 쓰는 키",
   "오른쪽 클릭 메뉴에 쓰는 키", "글자 편집에 쓰는 키", "Windows가 쓰는 키",
   "입력기에 쓰는 키", and "이름표 바로 가기에 쓰는 키". The intro says the key
   field keeps recording and shows the error ring, as sent to ui for ui-4.
2. **The output restart limit (`08-problems.md`, "Output window crash").** The
   section now has "Restarting" and "The restart limit (lead rule)". After 3
   crashes in 60 seconds, the window stays shown with the screen's empty
   picture, the limit is logged at error level, and attempts follow after a
   cool-down of 10 seconds that doubles after each failed attempt up to 60
   seconds (proposal). A window that runs 60 seconds ends the limit. While the
   limit holds, a warning notification with 다시 시도 and an amber outline on
   the preview frame show the problem; success turns the card into an
   information card. qa's measured 1.2 seconds is recorded as an observation
   next to the 1 second target. The problem table and the notification table are
   updated, and `03-output.md` "When an output window crashes" points to the new
   rule.
3. **What the 진행 previews show (`04-show.md`, "Preview panel").** Checked
   against the ProPresenter 7.5 user guide: the Preview window shows the output
   of one chosen screen (pp. 24 to 26), a click fires a slide and the active
   slide is outlined in orange (pp. 12, 70), the clear buttons turn red when a
   layer has content (p. 25), and Next Slide is a stage layout object (p. 41).
   04 now states that each preview shows the screen's output exactly and follows
   the live output, never the selection; that no preview shows the next 장
   except through a stage layout's next lyrics element; what a clear and an
   empty screen look like; and the existing layout and state rules.

## Changed files

- `docs/spec/10-shortcuts-and-settings.md`
- `docs/spec/08-problems.md`
- `docs/spec/04-show.md`
- `docs/spec/03-output.md`
- `docs/reviews/spec-7.md` (new)

## Checks run

| Command or test            | Result                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` (round 2) | Pass on base `8273192`: 88 files, 903 tests, 1 skipped; 156.5 s in all                                                                       |
| `npm run verify` (round 1) | Pass: typecheck 14.5 s, lint 94.9 s, format:check 29.6 s, test:coverage 74.7 s (74 files, 753 tests, 1 skipped), build 3.0 s; 216.8 s in all |
| Middle dots and em dashes  | None in the changed files (checked with `grep -c`)                                                                                           |

## Decisions I made (for the lead to confirm)

1. **Chroma for the 방송 자막 window at the limit.** The lead's rule says black.
   The 방송 자막 capture window shows its chroma color instead, because OBS keys
   that color out, and a black window would put a black box over the broadcast.
   The 본 화면 and 무대 화면 show black.
2. **The cool-down: 10, 20, 40, then 60 seconds.** A short first wait recovers
   quickly from a brief cause; doubling keeps a repeating crash from loading the
   computer or flickering; the 60-second cap keeps trying during a service.
3. **The amber outline on the preview frame at the limit.** The preview draws
   the live state while the audience sees an empty picture, so the operator
   needs a mark in the place they watch. It reuses the `PreviewFrame` warning
   state.
4. **Turning the output on and off still works at the limit:** off stops the
   attempts, and on starts one at once. This keeps output-1's retry as a manual
   path next to 다시 시도.
5. **Previews follow the live output, never the selection.** This follows
   ProPresenter. The `SlideThumbnail` selected ring and the 준비 preview keep
   their own rules.

## Where to look

- The two tables in 08 (problem states, notifications) and the new section.
- The guide citations in 04's "Preview panel".
