# StatusBar

The 28px row at the very bottom of the window. It stays empty when nothing needs attention and shows short text only for a problem or a wait, so anything in it is something to check.

## Where to use

- At the very bottom of the main window, with the same shape and height in every workspace and in a narrow window.

## Where not to use

- Problems to report during a service (a monitor is gone, a media file is missing): report them first with a notification (Notification) and the warning on the toolbar output buttons. The status bar is only a small, always visible place to check.
- Which screens are on: the toolbar output buttons show that. The status bar doesn't list the screens in the normal state.
- Don't put buttons or menus in it. Saving and turning 출력 (output) on and off happen elsewhere.
- Don't put task guidance or help text in it.

## Anatomy

- Row: height `size-statusbar` (28px), background `bg-app`, horizontal padding 18px, gap between items 18px, text `caption` (14/20) `text-3`, tabular numbers.
- Messages: pushed to the right end, one per condition, in the order 대기, the save state, then each screen's problems in the order 청중 화면, 무대 화면, 방송 화면. A long row scrolls sideways instead of wrapping.
- Text keeps at least 4.5:1 contrast on `bg-app`.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Status bar | `size-statusbar` 28 | `caption` `text-3` | Very bottom of the main window (both regular and narrow windows) |

## States

| State | Text |
| --- | --- |
| Nothing needs attention | Empty row |
| Output state recovery dialog open | "대기" |
| Saving takes a while | "저장을 시도하는 중..." |
| Saving failed | "저장하지 못함" |
| No monitor | "무대 화면 창으로 표시 중" |
| Output window restarting | "청중 화면 출력 창을 다시 시작하는 중" |
| Restart limit reached | "청중 화면 다시 시작 시도 제한됨" |
| Dropped frames | "프레임 속도가 낮아지는 중: 방송 화면 (41fps)" |

## Behavior

- A message appears when its condition starts and goes away when it ends. Don't animate the change.
- Dropped frames: show the message when the fps stays more than 10% below the target (60) for 2 seconds, and remove it after it has recovered for 2 seconds, so it doesn't flicker when the number wavers.
- Nothing in it can be clicked, so it doesn't take focus. For screen readers, the row has `role="status"`.

## Writing

- Each message says plainly what is happening, as a short Korean phrase: "저장을 시도하는 중...", "무대 화면 창으로 표시 중". Never a code or a bare number.
- Write the full screen names (청중 화면, 무대 화면, 방송 화면). They can differ from the short names on the toolbar buttons (무대).
- Don't add words such as "정상" (healthy) or "OK".

## Implementation notes

```jsx
<StatusBar standby={false} saveState="saving" />
```

- `saveState`: `'saving'` | `'failed'` | absent. The output problems come from the screen summaries and output statuses.

## Changes from the drafts

- Compact: status bar height 24 → 28, horizontal padding 16 → 18, gap 14 → 18.
- The drafts showed the last save time on the left and each screen's fps on the right in the normal state. Both were removed after a screenshot review, where three dim names read as unexplained text (user, October 29).
