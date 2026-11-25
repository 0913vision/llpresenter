import {isComposingKey} from '@renderer/ui/fields/ime';

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

/** Why a key can't be a slide's hot key. */
export const SLIDE_HOT_KEY_REASON = '영문자나 숫자 키만 쓸 수 있습니다.';

/** A recorder action, independent of the stored slide field. */
export type SlideHotKeyPress =
  | {readonly kind: 'pass' | 'ignore' | 'remove' | 'reject'}
  | {readonly kind: 'record'; readonly code: string};

/** Records an unmodified physical key; dialog navigation keeps its native keys. */
export function slideHotKeyPress(event: KeyboardEvent): SlideHotKeyPress {
  if (isComposingKey(event) || event.repeat || MODIFIER_CODES.has(event.code)) {
    return {kind: 'ignore'};
  }
  if (movesInDialog(event)) return {kind: 'pass'};
  if (isModified(event)) return {kind: 'reject'};
  if (event.code === 'Backspace' || event.code === 'Delete') {
    return {kind: 'remove'};
  }
  const code = letterOrDigit(event);
  return code === undefined ? {kind: 'reject'} : {kind: 'record', code};
}

function isModified(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
}

/** Tab and Shift Tab move through the dialog; Enter and Escape answer it. */
function movesInDialog(event: KeyboardEvent): boolean {
  if (event.code === 'Tab') {
    return !event.ctrlKey && !event.altKey && !event.metaKey;
  }
  return (
    ['Enter', 'NumpadEnter', 'Escape'].includes(event.code) &&
    !isModified(event)
  );
}

/**
 * The letter or digit key pressed, a number pad digit as the digit when Num
 * Lock is on; none for another key.
 */
function letterOrDigit(event: KeyboardEvent): string | undefined {
  const code =
    /^Numpad[0-9]$/.test(event.code) && event.getModifierState('NumLock')
      ? event.code.replace('Numpad', 'Digit')
      : event.code;
  return /^(Key[A-Z]|Digit[0-9])$/.test(code) ? code : undefined;
}
