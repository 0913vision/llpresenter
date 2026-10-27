# AlertDialog

A confirmation dialog that the user must answer, with one question, before moving on. It has a 40px icon cell on the left, a title, extra info, and a button row. A dialog with a few states to pick (출력 상태 복구 (output state recovery)) puts a list section under the same head group.

## Where to use

- Saving a song when a song with the same title exists (ImportSave): "‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?"
- Restarting after an abnormal exit (Recovery): "출력 상태 복구" and picking the states to restore
- Before a deletion that can't be undone

## Where not to use

- Tasks with several inputs or picking from a long list: use `Dialog`.
- Notices that need no answer: use `Notification`.
- Confirming that a task is done ("저장했습니다", "지웠습니다"): don't show anything.

## Anatomy

- Scrim and position: same as `Dialog` (`ll-scrim`, covers from under the menu bar, centered).
- Surface `ll-alert`: width `dialog-s` (460px), background `bg-dialog`, corner radius `radius-2xl`, shadow `shadow-dialog`, padding `space-20` top, `space-20` left and right, `space-16` bottom. There are no header or footer lines.
- Head group `ll-alert__head`: icon cell + `space-14` + text group, aligned to the top.
  - When long names would exceed the viewport height, the head shrinks and scrolls vertically with a thin `line-strong` scrollbar. The button row remains visible. Only an overflowing head joins the Tab cycle as a region named "확인 내용"; its inset focus ring uses `ring-field-focus`.
  - Icon cell `ll-alert__icon`: 40×40, background `bg-panel`, corner radius `radius-lg`, icon 24px `text-2`. It shows what the question is about (song `song`, recovery `history`).
  - Title `ll-alert__title`: `heading` (22/30/600), wraps at word boundaries, or within an unbroken name when needed to fit.
  - Extra info `ll-alert__meta`: `space-2` under the title, `label` (14/20) `text-3`, tabular numbers. With two or more values, `space-10` between them ("비정상 종료  10월 25일 오전 11:26").
  - With a one-line title and one metadata line, the text group is 52px high (30 + 2 + 20), exceeding the 40px icon cell. Each metadata value can wrap within the text column, including long unbroken names.
- List section `ll-alert__list` (list type, `ll-alert--list`): width `dialog-m` (600px). `space-16` under the head group, 1px `line` at the top. Group names are `ll-row-group` from `ListRow` (0 left and right, 10 top, 5 bottom), and rows are `ll-check-row` from `Checkbox` (30px, no side padding and no hover, 168px name cell `--fixed`, value `__value` in `label` `text-3`). This section scrolls independently within the remaining height; the button row remains visible.
- Button row `ll-alert__actions`: `space-20` above, md buttons (30px), `space-8` between them. [취소] `ll-alert__cancel` goes at the left end, the rest on the right, and the primary button at the far right. In a dialog without [취소], put all buttons on the right.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| One question (`dialog-s`) | 126 without metadata; 138 with one metadata line (20 + 52 + 20 + 30 + 16), one-line title | `heading` 22/30/600, `label` 14/20 `text-3` | Overwriting the same song, confirming a deletion |
| List type (`dialog-m`) | Content (30 per row) | Same as above + check rows `body` 16/22 | 출력 상태 복구 |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Open | Scrim `scrim` + surface `bg-dialog` | | 160ms fade, focus on the primary button |
| Overflowing head | Same surface | Same text | Thin scrollbar; inset focus ring when the region receives keyboard focus; buttons stay visible |
| Secondary button | `bg-control` | `text` | Hover and pressed `bg-control-hover` (`Button`) |
| Primary button | `accent-fill` | `text-on-fill` 600 | Hover and pressed `accent-fill-hover` |
| Check row off | `bg-well` box | `text` | That state isn't restored |
| All checks off | Primary button `bg-control` | Primary button `text-off` | [복구] is disabled (`aria-disabled`) |

## Behavior

- When the dialog opens, focus the primary button. Enter triggers the primary button, and Esc triggers [취소]. In 출력 상태 복구, which has no [취소], Esc triggers [새로 시작].
- Tab order: overflowing head (if any) → check rows (if any) → buttons from the left. An ordinary head adds no Tab stop. Arrow/Page/Home/End keys scroll the focused head natively.
- A confirmation dialog has no close (×) button. A click on the scrim doesn't close it.
- Don't open another confirmation dialog on top of a confirmation dialog.
- 출력 상태 복구 opens as soon as the app starts, and the three screens wait until the user answers (status bar "대기").
- The 지우기 (clear) shortcuts for 출력 (output) (F1 to F7) work even while a confirmation dialog is open (same as `Dialog`).
- aria: `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` set to the title, `aria-describedby` set to the extra info. The list section is `role="group"` + the group name.
- Recalculate head overflow after its viewport or text size changes. Release size observers when the dialog closes.

## Writing

- End the title with one question: "‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?" Wrap the object's name in ‘ ’.
- When it is clear what the dialog asks, write the title as a noun: "출력 상태 복구".
- Write only the facts needed to decide as extra info: "라이브러리 곡 슬라이드 4개, 10월 20일 수정", "비정상 종료  10월 25일 오전 11:26". Don't write explanatory paragraphs.
- When saving a duplicate as a new song, show the exact available title before committing: "새 곡 제목: ‘만복의 근원 하나님 (2)’". Keep it in the metadata read by `aria-describedby`, and wrap it without clipping.
- When deleting a shared label definition, show its name and the retained-reference fact `모든 곡의 이름표 유지` in metadata. The delete action tooltip explains that removal affects the shared list only. Do not suggest that song labels or slides are deleted.
- Write buttons as verbs for what happens: "덮어쓰기", "새 곡으로 저장", "복구", "새로 시작". Don't use "예" (Yes), "아니요" (No), or "확인" (OK).

## Implementation notes

- `<AlertDialog icon="song" title="‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?" meta={['라이브러리 곡 슬라이드 4개, 10월 20일 수정']} cancel="취소" actions={[{ label: '새 곡으로 저장' }, { label: '덮어쓰기', primary: true }]} />`
- `<AlertDialog icon="history" title="출력 상태 복구" meta={['비정상 종료', '10월 25일 오전 11:26']} list={{ label: '복구할 상태', items: [{ icon: 'mplay', label: '화면 출력', value: '본 화면, 무대 화면, 방송 자막', checked: true }, …] }} actions={[{ label: '새로 시작', escape: true }, { label: '복구', primary: true }]} />`
- Classes: `ll-alert`, `ll-alert--list`, `ll-alert__head`, `ll-alert__icon`, `ll-alert__text`, `ll-alert__title`, `ll-alert__meta`, `ll-alert__list`, `ll-alert__actions`, `ll-alert__cancel`.

## Changes from the drafts

- ImportSave: background #262626 → `bg-dialog`. Scrim rgba(0, 0, 0, 0.45) over the whole window → `scrim` from under the menu bar. Icon cell 36×36, radius 8, `bg-panel` + 1px #3a3a3a, icon 18 → 40×40 `radius-lg` with no border, icon 24. Gap between icon and text stays 14. Title 14/20 → `heading` 22/30, gap between title and extra info 6 → 2. Secondary button #333333 → `bg-control`. Primary button #3d8bf0 → `accent-fill`, horizontal padding 16 → 14. Shadow 0 20px 48px → `shadow-dialog`.
- Recovery: icon cell #262626, radius 8 → `bg-panel`, `radius-lg`, icon `text` → `text-2`. Head group centered → aligned to the top, gap between title and extra info 3 → 2. Group name 12 top, 6 bottom → 10, 5. Row heights and gaps are in the `Checkbox` document. Footer (1px line at the top, height 60, 20 left and right) → button row with no line (20 top, 16 bottom). Buttons 32 → 30. Shadow 0 20px 48px → `shadow-dialog`.
