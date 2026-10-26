# Notification

Reports an app problem or recovery in the top-right column. Every workspace
uses `NotificationStack` and `NotificationCard`, including media import failures,
output connection changes and save failures.

## Where to use

- App problems that need attention, such as a lost monitor or failed import.
- Recovery information, such as a monitor reconnecting.
- Missing files on existing tiles use their in-place missing-file state.
- Successful operator actions use the status bar. Questions use `AlertDialog`.

## Placement and anatomy

- The stack's outer box matches the right column: `col-right` (480px), or
  `col-right-compact` (360px). Anchor it `panel-gap` below the toolbar and from
  the right window edge, then inset cards by `space-8` on the top and sides.
  Cards therefore sit 12px from the toolbar and window edge. Separate cards
  with `space-8`. Use `z-notification`, above dialogs and their scrim.
- Card: `bg-raised`, `radius-lg`, `shadow-popover`, `space-8` padding and gaps.
  This is the same floating surface as menus, with the corner treatment of
  nearby panels. Avoid the heavier dialog shadow. A warning keeps `bar-warning`
  on its inside left edge.
- Leading icon: 18px, `warning` for warnings or `text-2` for information.
  Center its mask in a `size-control-sm` (26px) title line.
- Title row: `type-title` (16/22/600), with `type-label` (14/20) time in
  `text-3` at the trailing edge. Keep `space-10` between title and time. Long
  titles truncate; the time and close control remain visible.
- Details: `space-2` below the title row, `type-label` in `text-2`. Use
  `space-8` between values and arrows. Each 12px `text-3` arrow has a flex
  wrapper centered on the line, without an inline text baseline. Long values
  wrap within the card. Use `space-4` between wrapped lines.
- Actions: up to two secondary small buttons, `space-10` below the text,
  separated by `space-6`.
- Close: standard 26px `IconButton`, aligned with the title and leading icon.
  No negative margin. Use `bg-control-hover` on hover or press.

## States and motion

| State | Appearance | Lifetime |
| --- | --- | --- |
| Warning | `warning` icon and inset bar, `role="alert"` | Until resolved or closed |
| Information | `text-2` icon, `role="status"` | Six seconds |
| Pointer or focus inside | No visual change | Restart six seconds on leaving |
| Focus on action or close | Standard 2px `accent` focus ring | No focus stealing |
| Arrival, replacement or dismissal | Immediate | No fade, translation or delayed removal |

Operational state must be readable immediately. Do not use `motion-popover` or
`motion-dialog` on cards, and do not animate the right column. Interactive
controls keep `motion-hover`. Reduced motion has the same immediate behavior.

## Behavior and accessibility

- Newest first, at most three. Replace the same cause instead of duplicating
  it. At the limit, drop the oldest information card before a warning.
- Lasting warnings reserve the vertical space through the bottom of the last
  warning, including the stack's top inset. The right column begins a
  `panel-gap` below it. Information cards float without reserving space.
- Resolution replaces a warning with information. Closing restores the column
  immediately. The problem can still be shown by its toolbar/status mark.
- Keep the notification portal outside modal `inert`. Actions participate in
  the modal Tab cycle. Notifications never take focus or make a sound.
- Name each card with `aria-labelledby` pointing to its title. Escape belongs
  to menus and dialogs and does not dismiss the card.
- The stack's empty area passes pointer events through to the app.

## Writing and implementation

Use a noun phrase without punctuation for the title, a 24-hour `HH:MM` time,
short current-state details and verb action labels. No apologies or exclamations.

`addNotice` replaces by key and caps the list; `removeNotice` removes by key.
Keep each notice object stable while displayed, because a replacement restarts
its lifetime. `NotificationStack.onWarningHeightChange` reports the reserved
height. Release timers and the stack's `ResizeObserver` on unmount.

The design and renderer galleries cover warnings, recovery information, actions,
long metadata and a replaceable, dismissible stack. M3-C3-5 replaces the old
edge-to-edge, rounded dialog card and its entry fade with this treatment.
