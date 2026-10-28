import {
  isKeyCode,
  keyModifiers,
  type KeyBinding,
} from '@shared/schema/shortcuts';

const keyNames: Readonly<Record<string, string>> = {
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  ContextMenu: 'Menu',
  PrintScreen: 'Print Screen',
  ScrollLock: 'Scroll Lock',
  CapsLock: 'Caps Lock',
  NumLock: 'Num Lock',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .',
  NumpadEnter: 'Num Enter',
  NumpadEqual: 'Num =',
  NumpadComma: 'Num ,',
  IntlBackslash: '\\',
  IntlRo: '\\',
  IntlYen: '¥',
  MediaPlayPause: 'Media Play/Pause',
  MediaStop: 'Media Stop',
  MediaTrackNext: 'Media Next',
  MediaTrackPrevious: 'Media Previous',
  AudioVolumeUp: 'Volume Up',
  AudioVolumeDown: 'Volume Down',
  AudioVolumeMute: 'Volume Mute',
};
const modifierNames = {ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift'} as const;

/** Windows key names from a physical binding, independent of the IME. */
export function shortcutNames(binding: KeyBinding): readonly string[] {
  const {code, mods} = binding;
  const name =
    keyNames[code] ??
    code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'Num ');
  return [...mods.map(mod => modifierNames[mod]), name];
}

export type ShortcutPress =
  | {readonly kind: 'modifier'}
  | {readonly kind: 'cancel'}
  | {readonly kind: 'remove'}
  | {readonly kind: 'tab'}
  | {readonly kind: 'reject'; readonly reason: string}
  | {readonly kind: 'record'; readonly binding: KeyBinding};

/** Classifies one press in the recorder's reserved-key precedence order. */
export function shortcutPress(event: KeyboardEvent): ShortcutPress {
  const {
    code,
    ctrlKey: ctrl,
    altKey: alt,
    shiftKey: shift,
    metaKey: meta,
  } = event;
  const bare = !ctrl && !alt && !shift && !meta;
  if (code === 'Escape' && !ctrl && !alt && !meta) return {kind: 'cancel'};
  if (code === 'Backspace' && bare) return {kind: 'remove'};
  if (code === 'Tab' && !ctrl && !alt && !meta) return {kind: 'tab'};
  const reason = reservedReason(event);
  if (reason !== undefined) return {kind: 'reject', reason};
  if (/^(Control|Alt|Shift)(Left|Right)$/.test(code)) return {kind: 'modifier'};
  if (!isKeyCode(code)) {
    return {kind: 'reject', reason: '지원하지 않는 키'};
  }
  return {
    kind: 'record',
    binding: {
      code,
      mods: keyModifiers.filter(mod => ({ctrl, alt, shift})[mod]),
    },
  };
}

function reservedReason(event: KeyboardEvent): string | undefined {
  const {
    code,
    ctrlKey: ctrl,
    altKey: alt,
    shiftKey: shift,
    metaKey: meta,
  } = event;
  if (
    code === '' ||
    /^Lang[12]$/.test(code) ||
    (event.isComposing && !/^F[1-7]$/.test(code))
  ) {
    return '입력기에 쓰는 키';
  }
  if (
    meta ||
    /^Meta(Left|Right)$/.test(code) ||
    code === 'PrintScreen' ||
    (alt && !ctrl && !shift && (code === 'F4' || code === 'Tab')) ||
    (ctrl && !alt && !shift && code === 'Escape') ||
    (ctrl && alt && !shift && code === 'Delete')
  ) {
    return 'Windows가 쓰는 키';
  }
  if (code === 'ContextMenu' || (code === 'F10' && shift && !ctrl && !alt)) {
    return '오른쪽 클릭 메뉴에 쓰는 키';
  }
  if (code === 'F10' && !ctrl && !alt && !shift) return '메뉴 막대에 쓰는 키';
  if ((code === 'Enter' || code === 'NumpadEnter') && !ctrl && !alt && !shift) {
    return '확인과 실행에 쓰는 키';
  }
  if (ctrl && !alt && !shift && /^Key[XCVA]$/.test(code)) {
    return '글자 편집에 쓰는 키';
  }
  if (!ctrl && !alt && !shift && /^(Key[A-Z]|Digit\d|Numpad\d)$/.test(code)) {
    return '슬라이드 바로 가기에 쓰는 키';
  }
  return undefined;
}
