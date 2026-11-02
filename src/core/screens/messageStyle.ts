import {DEFAULT_MESSAGE_STYLE, type MessageStyle} from '../schema/messages';

/**
 * The style a screen draws its 메시지 in. A missing or unknown id means the
 * built-in 기본 style.
 */
export function resolveMessageStyle(
  styles: readonly MessageStyle[] | undefined,
  id: string | undefined,
): MessageStyle {
  if (id === undefined) return DEFAULT_MESSAGE_STYLE;
  return styles?.find(style => style.id === id) ?? DEFAULT_MESSAGE_STYLE;
}
