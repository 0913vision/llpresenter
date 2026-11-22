import {isComposingKey} from '@renderer/ui/ime';

const MODIFIER_CODES: ReadonlySet<string> = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

export const SLIDE_HOT_KEY_REASON = '영문자나 숫자 키만 쓸 수 있습니다';

/** A recorder action, independent of the stored slide field. */
export type SlideHotKeyPress =
  | {readonly kind: 'pass' | 'ignore' | 'remove' | 'reject'}
  | {readonly kind: 'record'; readonly code: string};

/** Records an unmodified physical key; dialog navigation keeps its native keys. */
export function slideHotKeyPress(event: KeyboardEvent): SlideHotKeyPress {
  if (isComposingKey(event) || event.repeat || MODIFIER_CODES.has(event.code)) {
    return {kind: 'ignore'};
  }
  const modified =
    event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
  if (
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    event.code === 'Tab'
  ) {
    return {kind: 'pass'};
  }
  if (
    !modified &&
    (event.code === 'Enter' ||
      event.code === 'NumpadEnter' ||
      event.code === 'Escape')
  ) {
    return {kind: 'pass'};
  }
  if (modified) return {kind: 'reject'};
  if (event.code === 'Backspace' || event.code === 'Delete') {
    return {kind: 'remove'};
  }
  const code =
    /^Numpad[0-9]$/.test(event.code) && event.getModifierState('NumLock')
      ? event.code.replace('Numpad', 'Digit')
      : event.code;
  return /^(Key[A-Z]|Digit[0-9])$/.test(code)
    ? {kind: 'record', code}
    : {kind: 'reject'};
}
