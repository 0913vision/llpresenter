// NOTE(0913vision): valibot drops object keys named __proto__, prototype, and
// constructor to prevent prototype pollution, which would lose unknown fields
// with those names. The schemas therefore see such keys under an escaped name,
// and the keys get their own names back afterwards as own data properties.

const ESCAPE_PREFIX = '\u0000';
const KEYS_VALIBOT_DROPS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * A deep copy of JSON data in which every key valibot would drop, and every key
 * that already starts with the escape prefix, gets the prefix. The mapping is
 * one to one, so {@link restoreKeys} can undo it.
 */
export function escapeKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(escapeKeys);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const copy = {};
  for (const [key, child] of Object.entries(value)) {
    defineOwn(copy, escapeKey(key), escapeKeys(child));
  }
  return copy;
}

/**
 * Gives escaped keys their own names back, in place and in the same order. Use
 * it only on data that {@link escapeKeys} or the schema just created.
 */
export function restoreKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(restoreKeys);
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  const entries = Object.entries(value);
  entries.forEach(([, child]) => restoreKeys(child));
  if (!entries.some(([key]) => isEscaped(key))) {
    return;
  }
  for (const [key] of entries) {
    Reflect.deleteProperty(value, key);
  }
  for (const [key, child] of entries) {
    defineOwn(value, restoreKey(key), child);
  }
}

/** Gives the escaped keys of a dot path their own names back. */
export function restoreKeyPath(path: string): string {
  return path.split('.').map(restoreKey).join('.');
}

function escapeKey(key: string): string {
  return KEYS_VALIBOT_DROPS.has(key) || isEscaped(key)
    ? `${ESCAPE_PREFIX}${key}`
    : key;
}

function restoreKey(key: string): string {
  return isEscaped(key) ? key.slice(ESCAPE_PREFIX.length) : key;
}

function isEscaped(key: string): boolean {
  return key.startsWith(ESCAPE_PREFIX);
}

function isPlainObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function defineOwn(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}
