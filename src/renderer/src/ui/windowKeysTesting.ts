import {onTestFinished} from 'vitest';

/** A key that reached the window, and whether a part cancelled it. */
export interface WindowKey {
  readonly key: string;
  readonly cancelled: boolean;
}

/**
 * Records every keydown that reaches the window until the test ends, so a
 * test can check that a part left a key to the window shortcuts.
 */
export function recordWindowKeys(): readonly WindowKey[] {
  const keys: WindowKey[] = [];
  const listener = (event: KeyboardEvent): void => {
    keys.push({key: event.key, cancelled: event.defaultPrevented});
  };
  window.addEventListener('keydown', listener);
  onTestFinished(() => window.removeEventListener('keydown', listener));
  return keys;
}

/** The keys among those recorded that reached the window uncancelled. */
export function passedKeys(keys: readonly WindowKey[]): string[] {
  return keys.filter(key => !key.cancelled).map(key => key.key);
}
