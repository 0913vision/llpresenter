import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {isComposingKey} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {modalStack} from '@renderer/ui/modalStack';
import {SHORTCUT_RECORDING_SELECTOR} from '@renderer/ui/shortcutRecording';

const MOVES = {
  ArrowRight: 1,
  ArrowLeft: -1,
} as const;

/** The index that a move lands on, wrapping around the ends. */
export function menuBarTarget(
  count: number,
  from: number,
  key: string,
): number | undefined {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') return undefined;
  return (from + MOVES[key] + count) % count;
}

export interface MenuBarNavigation<Name extends string> {
  /** Props that make a menu button one stop of the bar. */
  readonly stopProps: (name: Name) => {
    readonly tabIndex: 0 | -1;
    readonly ref: (element: HTMLButtonElement | null) => void;
    readonly onFocus: () => void;
  };
  /** Moves focus along the bar; `false` when the key is not a move. */
  readonly onBarKey: (name: Name, event: KeyboardEvent) => boolean;
  /** The trigger of the menu next to `name`, going `step` places. */
  readonly neighbor: (name: Name, step: 1 | -1) => Name;
  readonly elementOf: (name: Name) => HTMLButtonElement | null;
  /** Puts focus on the first menu, as Alt and F10 do. */
  readonly focusBar: () => void;
}

/**
 * Makes a row of menu buttons one Tab stop, as the WAI-ARIA menubar pattern
 * and Windows menu bars do: ← and → move between the menus, Home and End go
 * to the ends, and Tab leaves the bar from the menu that was last focused.
 */
export function useMenuBarNavigation<Name extends string>(
  names: readonly Name[],
): MenuBarNavigation<Name> {
  const [stop, setStop] = useState<Name | undefined>(undefined);
  const elements = useRef(new Map<Name, HTMLButtonElement>());
  const current = stop ?? names[0];
  const elementOf = useCallback(
    (name: Name) => elements.current.get(name) ?? null,
    [],
  );
  const neighbor = (name: Name, step: 1 | -1): Name => {
    const index = names.indexOf(name);
    return names[(index + step + names.length) % names.length] ?? name;
  };
  return {
    stopProps: name => ({
      tabIndex: name === current ? 0 : -1,
      ref: element => {
        if (element === null) elements.current.delete(name);
        else elements.current.set(name, element);
      },
      onFocus: () => setStop(name),
    }),
    onBarKey: (name, event) => {
      if (hasModifier(event) || isComposingKey(event.nativeEvent)) return false;
      const target = menuBarTarget(
        names.length,
        names.indexOf(name),
        event.key,
      );
      if (target === undefined) return false;
      const next = names[target];
      if (next === undefined) return false;
      event.preventDefault();
      elements.current.get(next)?.focus();
      return true;
    },
    neighbor,
    elementOf,
    focusBar: () => {
      const first = names[0];
      if (first !== undefined) elements.current.get(first)?.focus();
    },
  };
}

/**
 * Alt pressed and released alone, and F10, focus the menu bar (spec 10, the
 * 메뉴 막대 row; `MenuBar` README). Any other key or a press in between cancels
 * Alt, so Alt with an arrow or a click still reaches its own command.
 */
export function useMenuBarEntryKeys(focusBarNow: () => void): void {
  const armed = useRef(false);
  const focusBar = useEffectEvent(focusBarNow);
  useEffect(() => {
    const blocked = (event: globalThis.KeyboardEvent): boolean =>
      modalStack.isOpen ||
      isComposingKey(event) ||
      (event.target instanceof Element &&
        event.target.closest(SHORTCUT_RECORDING_SELECTOR) !== null);
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Alt' && !event.repeat) {
        armed.current =
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.metaKey &&
          !blocked(event);
        return;
      }
      armed.current = false;
      if (
        event.key === 'F10' &&
        !event.defaultPrevented &&
        !hasModifier(event) &&
        !blocked(event)
      ) {
        event.preventDefault();
        focusBar();
      }
    };
    const onKeyUp = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Alt') return;
      const wasArmed = armed.current;
      armed.current = false;
      if (!wasArmed || event.defaultPrevented) return;
      event.preventDefault();
      focusBar();
    };
    const disarm = (): void => {
      armed.current = false;
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointerdown', disarm, true);
    window.addEventListener('blur', disarm);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pointerdown', disarm, true);
      window.removeEventListener('blur', disarm);
    };
  }, []);
}
