# Calendar

A date-only popover for date fields, starting with 새 예배. The field shows
`11월 1일 일요일`, uses the 16px `cal` icon and declares
`aria-haspopup="dialog"`. Time remains a separate control.

## Anatomy and tokens

- Width `size-calendar-width` (250px), padding `space-8`, `bg-raised`,
  `radius-xl`, `shadow-popover`. Place it `panel-gap` below the field, aligned
  to its left edge. Flip above near the bottom; keep `space-8` from window edges.
- Header: 30px (`size-calendar-day`), previous/next small `IconButton`s using
  `right` chevrons (mirrored for the previous month), with the centered month
  `2026년 5월` in `type-title`.
- Sunday first. Seven columns, six weeks, including adjacent-month dates.
  Weekday names `일 월 화 수 목 금 토` use `type-label`, `text-3` and
  `size-calendar-weekday` (24px) height. Weekends use the same colors.
- Day cells: `size-calendar-day` (30px) square, `space-4` gaps, `type-body`
  (16/22), tabular numbers and `radius-md`. The grid has a fixed height while
  navigating months. Do not stretch or animate the grid.
- Footer: `line` top divider, `space-8` margin/padding above a small 오늘 button.
  Choosing today commits today's local calendar date and closes the popover.

## States

| State | Treatment |
| --- | --- |
| Current month | `text`, transparent background |
| Adjacent month | `text-3`; choosing it commits that date |
| Selected date | `accent-fill`, `text-on-fill`, `aria-selected="true"` on the cell |
| Today, unselected | `ring-calendar-today`, `text`; `aria-current="date"` |
| Today, selected | Selected treatment and `aria-current="date"` |
| Keyboard focus | 2px `accent` outline, 1px offset; independent of selection |
| Hover/pressed, unselected | `bg-control-hover`, immediate highlight |
| Outside supported years | `text-off`, disabled; no hover |
| Month limit | Previous/next button disabled at January 0000/December 9999 |
| Disabled date field | Standard disabled Select; popover cannot open |

Use `motion-popover` for appearance and immediate removal, as other popovers.
No month slide, scale or exit delay. Reduced motion opens immediately.

## Interaction and accessibility

- Open on click, Enter, Space or Down. Start on the selected date; use today
  if no valid date is supplied. Moving focus or browsing a month does not edit
  the field. Commit only by choosing a day or 오늘.
- Left/right move one day; up/down one week. Home/End move to Sunday/Saturday
  of that week. Page Up/Down move a month, with Shift a year, retaining the day
  where possible and clamping to the target month's last day.
- Enter/Space choose the focused day. Escape closes without changing the value
  and returns focus to the date field. Closing must not cancel the parent dialog.
- Modified Enter, Space and Escape pass through without choosing or closing.
- Tab cycles through previous month, next month, the grid's one focused day
  and 오늘, skipping disabled controls. Keep focus inside the popover while it
  is open. A pointer press outside closes it and continues that pointer action.
- Use a named `role="dialog"`, a month heading announced politely, and a grid
  with weekday column headers. Each day has its full Korean date as its name.
  Focus and selected date are separate, with a single day in the Tab order.
- Store `YYYY-MM-DD` as a date, without timezone conversion. Arithmetic uses
  Gregorian civil dates, including leap years and the supported year bounds.
  Release document/viewport listeners and observers when the popover closes.

The design card shows a normal month with focus, selection and today, and the
lower year boundary with disabled adjacent dates and previous-month control.
