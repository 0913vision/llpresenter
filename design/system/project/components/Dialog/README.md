# Dialog

A dialog that closes only when the user finishes or cancels one task. It has a 44px header, a body with 16px padding, and a 52px footer, and it covers the area below the menu bar with a scrim. Use it for 새 예배 (new service), 다른 예배에서 가져오기 (import from another service), and 텍스트 가져오기 (import text).

## Where to use

- 새 예배: `dialog-l`, a two-column body (템플릿 (template) and past services on the left, 예배 순서 (service order) on the right) + an input bar above the footer (name, date, time)
- 다른 예배에서 가져오기: `dialog-l`, a two-column body
- 텍스트 가져오기: `dialog-xl`, an option bar under the header (슬라이드 나누기, 한 슬라이드에, 이름표 인식) + a 슬라이드 (slide) preview

## Where not to use

- A window that answers one question ("덮어쓸까요?", output state recovery): use `AlertDialog`.
- Picking one item from a short list: use the popover list from `Menu`.
- Something that only informs: use `Notification`.

## Anatomy

- Scrim `ll-scrim`: background `scrim`. It covers the area from under the menu bar (`size-menubar` 30px) to the bottom of the window and centers the dialog. It leaves 16px on the left and right. Stacking `z-dialog`. It doesn't cover the menu bar, but menus don't open while a dialog is open.
- Surface `ll-dialog`: background `bg-dialog`, corner radius `radius-2xl` (8px), shadow `shadow-dialog` (includes a 1px `line-strong` border). The width is one of `dialog-s/m/l/xl` (`ll-dialog--s` … `--xl`). The content decides the height, or the screen sets a value (새 예배 700). In a small window, width = window width − 32 and maximum height = window height − 64, and only the body scrolls.
- Header `ll-dialog__header`: height `size-dialog-header` (44px), `dialog-inset` (16px) on the left and `space-8` on the right, 1px `line` at the bottom.
  - Title `ll-dialog__title`: `title` (18/26/600).
  - Subtitle `ll-dialog__subtitle`: `space-12` after the title, `label` (14/20) `text-3`, leading icon 14px (gap `space-6`). The name of the object the dialog works on (a file name).
  - Close `ll-dialog__close`: a 30×30 ghost icon button, `x` 16px `text-2`, at the right end.
- Option bar and input bar `ll-dialog__bar`: height 52px (same as `size-dialog-footer`), 16px left and right, `space-20` between fields, `space-10` between a field name (`label` 14/20 `text-2`) and its control. Controls are md (30px). Above the footer, it has a 1px `line` at the top; under the header (`--top`), a 1px `line` at the bottom.
- Body `ll-dialog__body`: 16px padding. It takes the remaining height, and only the body scrolls when it overflows.
  - Two columns `ll-dialog__body--split`: `ll-dialog__aside` on the left, 260px (1px `line` on the right, no token), and `ll-dialog__main` on the right (16px padding, `space-12` between boxes).
  - The pick list on the left is `ll-rowlist--inset` from `ListRow` (8px padding, 44px two-line items). An action attached under the list is `ll-dialog__aside-foot` (8 left and right, 8 bottom, the ghost sm button "지금 예배를 템플릿으로 저장").
  - List box `ll-dialog__box`: background `bg-inset`, 1px inner `line` border, corner radius `radius-lg`. Header `ll-dialog__box-header` 34px (`label-strong` 16/22/600, a select-all checkbox in front, the count `ll-dialog__box-meta` in `text-3` on the right). Body `ll-dialog__box-body` (4 top, 8 bottom) holds the check rows from `Checkbox`.
- Footer `ll-dialog__footer`: height `size-dialog-footer` (52px), 16px left and right, 1px `line` at the top. Buttons are md (30px), aligned right, with `space-8` between them, in the order [취소] … [primary button]. There is one primary button, at the far right.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| `dialog-s` (460) | Content | - | Confirmation dialog (`AlertDialog`) |
| `dialog-m` (600) | Content | - | Output state recovery (`AlertDialog` with a list) |
| `dialog-l` (820) | 700 | - | 새 예배, 다른 예배에서 가져오기 |
| `dialog-xl` (1080) | Content | - | 텍스트 가져오기 |
| Header | 44 | `title` 18/26/600, subtitle `label` `text-3` | All dialogs |
| Option bar, input bar | 52 | Name `label` `text-2`, md controls | 텍스트 가져오기 options; 새 예배 name, date, time |
| Footer | 52 | md buttons, `body` | All dialogs |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Open | Scrim `scrim` + surface `bg-dialog` | | Scrim and surface fade over 160ms. At once under `prefers-reduced-motion` |
| Close, default | Transparent | `text-2` | |
| Close, hover | `bg-raised` | `text-2` | 100ms ease-out |
| Close, pressed | `bg-control-hover` | `text` | |
| Close, focus | Unchanged | Unchanged | outline 2px `accent`, offset 1px |
| Primary button disabled | `bg-control` | `text-off` | When a required value is empty. Reason in a tooltip (`Button`) |
| Body overflow | Unchanged | Unchanged | Only the body scrolls; the header, bars, and footer stay fixed |

## Behavior

- When the dialog opens, put focus in the first text field and select all its text (새 예배: the name field). If there is no text field, focus the primary button.
- An autosaving catalog manager can opt into surface focus. On open, no name is focused or selected and no field tooltip opens. Tab enters the first text field; Shift+Tab reaches the last footer action. Explicit creation still focuses and selects the new row's name.
- Focus cycles only inside the dialog (Tab, Shift+Tab). The order follows the screen: close → body → bar → footer.
- Enter triggers the primary button (when focus isn't in a multiline text field or a list). Esc and the close button do the same as [취소].
- Modified Enter and Esc pass through without submitting or canceling.
- A click on the scrim doesn't close the dialog.
- When the dialog closes, return focus to the button or menu item that opened it.
- In the service-source dialogs, reselecting the current source keeps the operator's item choices, including at a keyboard boundary. A different source starts a fresh selection: all items for 새 예배 and none for 다른 예배에서 가져오기.
- The 지우기 (clear) shortcuts for 출력 (output) (F1 to F7) work even while a dialog is open, because the operator must be able to clear the screens at once during a service.
- `Notification` appears above the scrim, and its action buttons stay clickable while a dialog is open.
- aria: `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` set to the title id. While the dialog is open, make the app behind it `inert` (except the notification layer).

## Writing

- Write the title as the name of the task: "새 예배", "다른 예배에서 가져오기", "텍스트 가져오기". Don't add a question mark or an explanation.
- Write the primary button as a verb: "만들기", "가져오기", "편집". Don't use "확인" (OK) or "예" (Yes).
- Don't put a paragraph of instructions above the body. Put whatever needs saying in field names or tooltips.
- Write only the object's name in the subtitle: "만복의 근원 하나님.txt".

## Implementation notes

- `<Dialog size="l" title="새 예배" onClose footer={<><Button size="md">취소</Button><Button size="md" variant="primary">만들기</Button></>}>…</Dialog>`
- `<Dialog size="xl" title="텍스트 가져오기" subtitle={{ icon: 'filetext', text: '만복의 근원 하나님.txt' }} bar={<DialogBar position="top">…</DialogBar>}>`
- Parts: `<DialogSplit aside={…}>`, `<DialogBox title="예배 순서" meta="항목 9개" checkAll>`, `<DialogBar position="top" | "bottom">`, `<DialogField label="이름">`.
- CSS handles the width and height limits (`max-width: calc(100vw - 32px)`, `max-height: calc(100vh - 64px)`).
- Classes: `ll-scrim`, `ll-dialog`, `ll-dialog--s`, `--m`, `--l`, `--xl`, `ll-dialog__header`, `ll-dialog__title`, `ll-dialog__subtitle`, `ll-dialog__close`, `ll-dialog__bar`, `ll-dialog__bar--top`, `ll-dialog__field`, `ll-dialog__field-label`, `ll-dialog__body`, `ll-dialog__body--split`, `ll-dialog__aside`, `ll-dialog__aside-foot`, `ll-dialog__main`, `ll-dialog__box`, `ll-dialog__box-header`, `ll-dialog__box-meta`, `ll-dialog__box-body`, `ll-dialog__footer`.

## Changes from the drafts

- NewService, ServiceImport: close button 28 → 30. Footer button text 12 → 13 (md), primary button background #3d8bf0 → `accent-fill`, primary button horizontal padding 16 → 14.
- NewService input bar: height 60 → 52. Date and time dropdown background #262626 → `bg-control` (`Select`).
- ImportText: width 980 → `dialog-xl` 1080, header 48 → 44, title 14px → 13px, left and right 18 → 16, gap between option bar fields 28 → 20, footer 56 → 52, footer buttons 32 → 30, shadow 0 20px 48px → `shadow-dialog`, scrim over the whole window → from under the menu bar.
