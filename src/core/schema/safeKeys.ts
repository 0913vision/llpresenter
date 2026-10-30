import type {Result} from '../common/result';

// NOTE(0913vision): valibot drops object keys named __proto__, prototype, and
// constructor to prevent prototype pollution, which would lose unknown fields
// with those names. The schemas therefore see such keys under an escaped name,
// and the keys get their own names back afterwards as own data properties.

const ESCAPE_PREFIX = '\u0000';
const KEYS_VALIBOT_DROPS = new Set(['__proto__', 'prototype', 'constructor']);

// NOTE(0913vision): Our files nest under 10 levels. The limit leaves room for
// unknown fields from later versions, and it turns deep or cyclic data into an
// error instead of a stack overflow or an endless walk.
const MAX_DEPTH = 64;
const TOO_DEEP_MESSAGE = `Nested deeper than ${MAX_DEPTH} levels, or refers to itself`;

/** JSON data ready for a schema, and whether any key had to be escaped. */
export interface EscapedData {
  readonly value: unknown;
  readonly changed: boolean;
}

interface Container {
  readonly value: object;
  readonly depth: number;
}

interface CopyTask {
  readonly source: unknown;
  readonly assign: (copy: unknown) => void;
}

/**
 * JSON data in which every key valibot would drop, and every key that already
 * starts with the escape prefix, gets the prefix. The mapping is one to one,
 * so {@link restoreKeys} can undo it. When no key needs it, the data comes back
 * as it is; otherwise it comes back as a copy. Data nested deeper than the
 * limit, or that refers to itself, gives an error. Never throws.
 */
export function escapeKeys(value: unknown): Result<EscapedData, string> {
  const scan = needsEscaping(value);
  if (!scan.ok) {
    return scan;
  }
  return {
    ok: true,
    value: scan.value
      ? {value: escapedCopy(value), changed: true}
      : {value, changed: false},
  };
}

/**
 * Gives escaped keys their own names back, in place and in the same order. Use
 * it only on data that {@link escapeKeys} changed, or that a schema made from
 * such data, which is never cyclic and never deeper than the limit.
 */
export function restoreKeys(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const next = pending.pop();
    if (isObject(next)) {
      pushEach(pending, childrenOf(next));
      restoreOwnKeys(next);
    }
  }
}

/** Gives the escaped keys of a dot path their own names back. */
export function restoreKeyPath(path: string): string {
  return path.split('.').map(restoreKey).join('.');
}

function needsEscaping(value: unknown): Result<boolean, string> {
  let found = false;
  const pending: Container[] = isObject(value) ? [{value, depth: 0}] : [];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next.depth > MAX_DEPTH) {
      return {ok: false, error: TOO_DEEP_MESSAGE};
    }
    if (!Array.isArray(next.value)) {
      found ||= Object.keys(next.value).some(shouldEscape);
    }
    for (const child of childrenOf(next.value)) {
      if (isObject(child)) {
        pending.push({value: child, depth: next.depth + 1});
      }
    }
  }
  return {ok: true, value: found};
}

function escapedCopy(value: unknown): unknown {
  let copy: unknown;
  const tasks: CopyTask[] = [
    {
      source: value,
      assign: result => {
        copy = result;
      },
    },
  ];
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    task.assign(shallowEscapedCopy(task.source, tasks));
  }
  return copy;
}

function shallowEscapedCopy(source: unknown, tasks: CopyTask[]): unknown {
  if (Array.isArray(source)) {
    const items: readonly unknown[] = source;
    const copy: unknown[] = Array.from({length: items.length});
    items.forEach((child, index) => {
      tasks.push({
        source: child,
        assign: result => {
          copy[index] = result;
        },
      });
    });
    return copy;
  }
  if (!isObject(source)) {
    return source;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    const escaped = escapeKey(key);
    copy[escaped] = undefined;
    tasks.push({
      source: child,
      assign: result => {
        copy[escaped] = result;
      },
    });
  }
  return copy;
}

function restoreOwnKeys(target: object): void {
  const entries = Object.entries(target);
  if (!entries.some(([key]) => isEscaped(key))) {
    return;
  }
  for (const [key] of entries) {
    Reflect.deleteProperty(target, key);
  }
  for (const [key, child] of entries) {
    Object.defineProperty(target, restoreKey(key), {
      value: child,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

function childrenOf(container: object): readonly unknown[] {
  return Array.isArray(container) ? container : Object.values(container);
}

function pushEach(target: unknown[], items: readonly unknown[]): void {
  for (const item of items) {
    target.push(item);
  }
}

function shouldEscape(key: string): boolean {
  return KEYS_VALIBOT_DROPS.has(key) || isEscaped(key);
}

function escapeKey(key: string): string {
  return shouldEscape(key) ? `${ESCAPE_PREFIX}${key}` : key;
}

function restoreKey(key: string): string {
  return isEscaped(key) ? key.slice(ESCAPE_PREFIX.length) : key;
}

function isEscaped(key: string): boolean {
  return key.startsWith(ESCAPE_PREFIX);
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
