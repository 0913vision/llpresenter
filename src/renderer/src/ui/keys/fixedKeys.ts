import type {KeyBinding} from '@core/schema/shortcuts';
import {shortcutNames} from '@core/shortcuts';

/**
 * The editing keys Windows gives every list and text field. The operator
 * cannot change them, so they are not in the shortcut settings.
 */
export const FIXED_KEYS = {
  copy: {code: 'KeyC', mods: ['ctrl']},
  cut: {code: 'KeyX', mods: ['ctrl']},
  paste: {code: 'KeyV', mods: ['ctrl']},
  selectAll: {code: 'KeyA', mods: ['ctrl']},
} as const satisfies Readonly<Record<string, KeyBinding>>;

export type FixedKey = keyof typeof FIXED_KEYS;

/** How a fixed key reads at the right end of a menu row, such as Ctrl C. */
export function fixedKeyText(key: FixedKey): string {
  return shortcutNames(FIXED_KEYS[key]).join(' ');
}
