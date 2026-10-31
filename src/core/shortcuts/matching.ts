import {keyModifiers, type KeyBinding} from '../schema/shortcuts';

export interface PhysicalKeyPress {
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly isComposing: boolean;
  readonly repeat: boolean;
  readonly getModifierState: (key: string) => boolean;
}

export function matchesBinding(
  event: PhysicalKeyPress,
  binding: KeyBinding,
): boolean {
  if (
    event.metaKey ||
    event.code === '' ||
    event.getModifierState('AltGraph')
  ) {
    return false;
  }
  const modifiers = {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  };
  return (
    event.code === binding.code &&
    keyModifiers.every(mod => modifiers[mod] === binding.mods.includes(mod))
  );
}

/** Only a slide hot key normalizes Num Lock digits to the top row. */
export function sourceSlideCode(event: PhysicalKeyPress): string | null {
  if (
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    event.metaKey ||
    event.isComposing
  ) {
    return null;
  }
  if (/^(Key[A-Z]|Digit\d)$/.test(event.code)) return event.code;
  return /^Numpad\d$/.test(event.code) && event.getModifierState('NumLock')
    ? event.code.replace('Numpad', 'Digit')
    : null;
}

/** Native field editing stays with the field regardless of a command's binding. */
export function editsText(event: PhysicalKeyPress): boolean {
  if (
    /^(Arrow(Up|Down|Left|Right)|Home|End|Backspace|Delete)$/.test(event.code)
  ) {
    return !event.altKey;
  }
  return event.ctrlKey && !event.altKey && /^Key([XCVAZY])$/.test(event.code);
}

/** Right Alt and Ctrl on Korean keyboards belong to the input method. */
export class PhysicalModifiers {
  private readonly down = new Set<string>();

  press(code: string): void {
    if (/^(Alt|Control)(Left|Right)$/.test(code)) this.down.add(code);
  }
  release(code: string): void {
    this.down.delete(code);
  }
  reset(): void {
    this.down.clear();
  }

  isInputMethod(event: PhysicalKeyPress): boolean {
    return (
      event.getModifierState('AltGraph') ||
      (event.altKey &&
        this.down.has('AltRight') &&
        !this.down.has('AltLeft')) ||
      (event.ctrlKey &&
        this.down.has('ControlRight') &&
        !this.down.has('ControlLeft'))
    );
  }
}
