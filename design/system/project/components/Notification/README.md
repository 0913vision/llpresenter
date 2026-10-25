# Notification

Shows something the app must report on its own as a card at the top right. A warning, such as a lost output monitor, stays until it is resolved, and information, such as a reconnected monitor, closes after 6 seconds.

## Where to use

- Warnings: a lost monitor connection for an output screen ("무대 모니터 연결 끊김", now showing in a window)
- Information: a lost monitor is connected again ("무대 모니터 다시 연결됨")

## Where not to use

- A problem with one 슬라이드 (slide) or one media item (missing media file): show it in place. Media tiles use `MediaTile`, thumbnails use the missing file look of `SlideThumbnail`, and list rows use the warning icon of `ListRow`. Don't show a notification card.
- The result of something the user just did (cleared, saved): don't show anything. The status bar reports saving with "23:41 저장됨".
- Something that needs an answer: use `AlertDialog`.

## Anatomy

- Position `ll-notice-stack`: `panel-gap` (4px) under the toolbar, 4px from the right of the window. In a regular window it is 90px from the top (30 + 56 + 4), and in a narrow window (`--compact`) 74px (30 + 40 + 4). The width matches the right column: `col-right` (480px), or `col-right-compact` (360px) in a narrow window. Stacking `z-notification` (above dialogs and the scrim).
- Card `ll-notice`: background `bg-raised`, corner radius `radius-2xl`, shadow `shadow-dialog`, padding 12 top, 8 right, 12 bottom, 14 left, `space-12` between parts.
  - Icon `ll-notice__icon`: 18px. `warning` for a warning, `text-2` for information. A warning card draws a 3px `warning` bar on the inside of its left edge.
  - Title row `ll-notice__head`: title `ll-notice__title` (`title` 13/18/600) + time `ll-notice__time` (`label` `text-3`), `space-10` between them.
  - Extra row `ll-notice__meta`: `space-2` under the title row, `label` `text-2`, `space-10` between values, arrow `arrow` 12px `text-3` ("모니터 3 → 창으로 표시 중").
  - Actions `ll-notice__actions`: `space-10` under the text, secondary sm buttons (leading icon 14px), `space-6` between them, up to two.
  - Close `ll-notice__close`: 26×26, `x` 16px `text-2`, raised by 4px to center it on the title row. The card is `bg-raised`, so the hover background is `bg-control-hover`.
- Stacking: the newest notification is on top, 4px apart, up to 3 cards. When there are more, close the oldest information card first. A notification with the same cause (same screen, same monitor) doesn't stack a new card; it replaces that card (lost → connected again).

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Warning | 96 (12 + 36 + 10 + 26 + 12) | `title` 13/18/600, `label` | Lost monitor connection |
| Information | 60 (12 + 36 + 12) | `title`, `label` | Connected again |
| Narrow window | Same, width 360 | Same | 1366×768 and similar |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Warning | `bg-raised` | Icon `warning` | 3px `warning` bar on the left. Stays until resolved or closed. `role="alert"` |
| Information | `bg-raised` | Icon `text-2` | Closes after 6 seconds. `role="status"` |
| Pointer over it, focus inside it | Unchanged | Unchanged | Pauses the close timer, and counts 6 seconds again after the pointer or focus leaves |
| Close, hover | `bg-control-hover` | `text-2` | 100ms |
| Close, pressed | `bg-control-hover` | `text` | |
| Close or action, focus | Unchanged | Unchanged | outline 2px `accent`, offset 1px |
| Appearing | | | 120ms fade, at once under `prefers-reduced-motion` |

## Behavior

- Don't cover the preview for long.
  - While a lasting warning card is present, move the right column down by the height of the card stack + 4px. The preview panel and its controls stay uncovered (same layout as the Problems draft). If there isn't enough height, the 진행 도구 (show tools) panel shrinks first, following the `Layout` rules.
  - An information card doesn't move the column down. It floats in place and closes after 6 seconds. It briefly covers the preview header and part of the top of the screen.
  - When the user closes a warning with close (×), only the card disappears and the right column returns to its place. The problem stays visible through the `warning` mark on the toolbar output button and the status bar text ("무대 화면 창으로 표시 중"). A click on that status bar text opens the card again.
- When the problem is resolved, the warning card turns into an information card ("무대 모니터 다시 연결됨") and closes after 6 seconds.
- Notifications don't move focus. The card's actions and close button go into the Tab order before the right column. Esc doesn't close a notification (menus and dialogs use Esc).
- Even while a dialog is open, notifications appear in the same place above the scrim, and their action buttons stay clickable.
- Notifications make no sound.
- aria: warning `role="alert"`, information `role="status"`, and `aria-labelledby` on the card pointing to the title.

## Writing

- Write the title as a noun phrase that says what happened to what, with no period: "무대 모니터 연결 끊김", "무대 모니터 다시 연결됨".
- Write the time in 24-hour format, without seconds: "11:24".
- Write the current state in the extra row: "모니터 3 → 창으로 표시 중".
- Write up to two actions, as verbs: "모니터 다시 찾기", "창 보기".
- Don't write apologies, exclamations, or explanatory sentences.

## Implementation notes

- `<NotificationStack notices={notices} compact={isCompact} onClose={key => …} onWarningHeightChange={height => …} />`. The caller keeps the list: `addNotice(notices, {kind: 'warning' | 'info', key: 'screen:stage', icon: 'plug', title: '무대 모니터 연결 끊김', time: '11:24', meta: ['모니터 3', '창으로 표시 중'], actions: [{icon: 'refresh', label: '모니터 다시 찾기', onSelect}, {icon: 'open', label: '창 보기', onSelect}]})` puts a card on top, replaces the card with the same `key`, and keeps at most 3; `removeNotice(notices, key)` takes one off. An information card calls `onClose` itself after 6 seconds.
- Pushing the right column down: the stack measures how far the lasting warning cards reach (ResizeObserver) and reports it through `onWarningHeightChange`; set the right column's `padding-top` to that height + 4px. When only information cards are present, it is 0.
- Keep the notification layer outside the modal's `inert`.
- Classes: `ll-notice-stack`, `ll-notice-stack--compact`, `ll-notice`, `ll-notice__icon`, `ll-notice__body`, `ll-notice__text`, `ll-notice__head`, `ll-notice__title`, `ll-notice__time`, `ll-notice__meta`, `ll-notice__actions`, `ll-notice__close`. A warning has `data-state="warning"`.

## Changes from the drafts

- Problems notification card: background #1c1c1c (`bg-panel`), radius 5, no shadow → `bg-raised`, `radius-2xl`, `shadow-dialog`. The 3px `warning` bar on the left stays. Close icon 14px #8c8c8c → 16px `text-2`. Extra row arrow #6e6e6e → `text-3`. Gap between title row and extra row 3 → 2.
