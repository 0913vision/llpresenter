import type {ThemeElement, ThemeText} from '../schema/themes';

/** Keeps optional title centering identical in output and thumbnails. */
export function themeTextVAlign(
  element: Extract<ThemeElement, {readonly text: unknown}>,
  currentText: string,
): ThemeText['vAlign'] {
  return element.kind === 'itemName' &&
    element.centerWhenTextEmpty === true &&
    currentText.trim() === ''
    ? 'middle'
    : element.text.vAlign;
}
