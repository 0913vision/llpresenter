# StatusBar

The 28px row at the very bottom of the window. It shows the last save time on the left and, in small type, the state of the three screen outputs on the right.

## Where to use

- At the very bottom of the main window, with the same shape and height in every workspace and in a narrow window.

## Where not to use

- Problems to report during a service (a monitor is gone, a media file is missing): report them first with a notification (Notification) and the warning on the toolbar output buttons. The status bar is only a small, always visible place to check.
- Don't put buttons or menus in it. Saving and turning 출력 (output) on and off happen elsewhere.
- Don't put task guidance or help text in it.

## Anatomy

- Row: height `size-statusbar` (28px), background `bg-app`, horizontal padding 18px, gap between items 18px, text `caption` (11/14) `text-3`, tabular numbers.
- Save state (left): icon `saved` `size-icon-14` + gap `space-6` + "23:41 저장됨".
- Output state (right, pushed to the right end from the first item): in the order 본 화면 (main screen), 무대 화면 (stage screen), 방송 자막 (broadcast captions). 6px dot (`radius-full`) + gap `space-6` + "본 화면 60fps".
- Use only two dot colors: `ok` (healthy) and `warning` (warning). Don't use `live` red (the toolbar shows that an output is on).

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Status bar | `size-statusbar` 28 | `caption` `text-3` | Very bottom of the main window (both regular and narrow windows) |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Saved | None | `text-3` | "23:41 저장됨". Tooltip "자동 저장 23:41" |
| Output healthy | None | `text-3` | `ok` dot. "본 화면 60fps" |
| Warning: no monitor | None | `warning` | `warning` dot. "무대 화면 창으로 표시 중" |
| Warning: dropped frames | None | `warning` | `warning` dot. "방송 자막 41fps" |
| Output off | None | `text-off` | No dot. Name only: "방송 자막" |

## Behavior

- Update the save time each time an autosave finishes. Don't animate the change.
- Update the fps every second. Switch to warning when it stays more than 10% below the target (60) for 2 seconds, and switch back to healthy after it has recovered for 2 seconds. Don't let the color flicker when the number wavers.
- While a monitor can't be found and a window shows the output instead, write "창으로 표시 중" (showing in a window). When the monitor comes back, return to healthy at once.
- Give each item a tooltip with the detailed reason: "무대 화면: 모니터 3을 찾을 수 없어 창으로 표시하고 있습니다", "방송 자막: 41fps, 목표 60fps".
- Nothing in it can be clicked, so it doesn't take focus. For screen readers, give the output state group `role="status"`, and announce only a change to warning.

## Writing

- Write short noun phrases: "23:41 저장됨", "본 화면 60fps", "무대 화면 창으로 표시 중".
- Write the full screen names (본 화면, 무대 화면, 방송 자막). They can differ from the short names on the toolbar buttons (무대).
- Don't add words such as "정상" (healthy) or "OK". For a healthy state, the number and the green dot are enough.

## Implementation notes

```jsx
<StatusBar>
  <SaveStatus savedAt="23:41" />
  <OutputHealth name="본 화면" fps={60} />
  <OutputHealth name="무대 화면" state="warning" text="창으로 표시 중" tooltip="무대 화면: 모니터 3을 찾을 수 없어 창으로 표시하고 있습니다" />
  <OutputHealth name="방송 자막" state="off" />
</StatusBar>
```

- `state` of `OutputHealth`: `'ok'` (default) | `'warning'` | `'off'`.
- Classes: row `ll-statusbar`, item `ll-statusbar__item`, first item of the right group `ll-statusbar__item--end`, dot `ll-statusbar__dot`. State is `data-state="warning|off"` on the item.

## Changes from the drafts

- Compact: status bar height 24 → 28, horizontal padding 16 → 18, gap 14 → 18, save icon 12 → 14. Output names "본 화면", "무대", "방송 자막" (no fps) → the same as in a regular window: "본 화면 60fps", "무대 화면 60fps", "방송 자막 60fps".
