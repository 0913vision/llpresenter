/** The attribute that marks a part that takes focus on a mouse click. */
export const CLICK_FOCUS_ATTRIBUTE = 'data-click-focus';

/**
 * Spread on a part that must take focus on a mouse click even in 진행: a list,
 * a grid, or a drag handle, where a cancelled `mousedown` would break
 * selection or dragging.
 */
export const clickFocusProps: Readonly<
  Record<typeof CLICK_FOCUS_ATTRIBUTE, ''>
> = {[CLICK_FOCUS_ATTRIBUTE]: ''};

/**
 * Matches the parts that take focus on a mouse click in 진행, where a click on
 * any other control leaves focus where it was
 * (docs/spec/10-shortcuts-and-settings.md): text fields and native slider
 * interaction, menus and dialogs, and parts marked with `clickFocusProps`,
 * including `ThumbnailGrid` and `ListBox`. Show sliders restore previous focus
 * when the pointer interaction ends. Use `closest` on the click target.
 */
export const CLICK_FOCUS_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="menu"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  `[${CLICK_FOCUS_ATTRIBUTE}]`,
].join(', ');
