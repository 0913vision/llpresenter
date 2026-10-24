import type {Result} from '../result';

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

interface CopyTask {
  readonly source: unknown;
  readonly depth: number;
  readonly assign: (copy: unknown) => void;
}

/**
 * A deep copy of JSON data in which every key valibot would drop, and every key
 * that already starts with the escape prefix, gets the prefix. The mapping is
 * one to one, so {@link restoreKeys} can undo it. Data nested deeper than the
 * limit, or that refers to itself, gives an error. Never throws.
 */
export function escapeKeys(value: unknown): Result<unknown, string> {
  let copy: unknown;
  const tasks: CopyTask[] = [
    {
      source: value,
      depth: 0,
      assign: result => {
        copy = result;
      },
    },
  ];
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (task.depth > MAX_DEPTH) {
      return {ok: false, error: TOO_DEEP_MESSAGE};
    }
    task.assign(shallowEscapedCopy(task, tasks));
  }
  return {ok: true, value: copy};
}

/**
 * Gives escaped keys their own names back, in place and in the same order. Use
 * it only on data that {@link escapeKeys} or the schema just created, which is
 * never cyclic and never deeper than the limit.
 */
export function restoreKeys(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const next = pending.pop();
    if (Array.isArray(next)) {
      const items: readonly unknown[] = next;
      pending.push(...items);
    } else if (isObject(next)) {
      const values: readonly unknown[] = Object.values(next);
      pending.push(...values);
      restoreOwnKeys(next);
    }
  }
}

/** Gives the escaped keys of a dot path their own names back. */
export function restoreKeyPath(path: string): string {
  return path.split('.').map(restoreKey).join('.');
}

function shallowEscapedCopy(
  {source, depth}: CopyTask,
  tasks: CopyTask[],
): unknown {
  if (Array.isArray(source)) {
    const copy: unknown[] = Array.from({length: source.length});
    source.forEach((child: unknown, index) => {
      tasks.push({
        source: child,
        depth: depth + 1,
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
      depth: depth + 1,
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

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
