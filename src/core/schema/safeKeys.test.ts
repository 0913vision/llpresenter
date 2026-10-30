import {describe, expect, it} from 'vitest';
import {escapeKeys, restoreKeyPath, restoreKeys} from './safeKeys';

const DANGEROUS_JSON =
  '{"a":1,"__proto__":{"polluted":true},"prototype":2,"constructor":3,' +
  '"list":[{"__proto__":4}],"\\u0000x":5}';
const MAX_DEPTH = 64;
// NOTE(0913vision): 200,000 entries are past the engine's argument limit for a
// spread, which the walk once hit. Building and walking them takes about two
// seconds, so the wide test gets more time than the default.
const WIDE_COUNT = 200_000;
const WIDE_TEST_TIMEOUT_MS = 30_000;

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

function escaped(value: unknown): unknown {
  const result = escapeKeys(value);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value.value;
}

function nestedArrays(depth: number): unknown {
  let value: unknown = [];
  for (let level = 1; level < depth; level++) {
    value = [value];
  }
  return value;
}

describe('escapeKeys and restoreKeys', () => {
  it('round-trips every key and keeps the key order', () => {
    const original = parseJson(DANGEROUS_JSON);

    const copy = escaped(original);
    restoreKeys(copy);

    expect(JSON.stringify(copy)).toBe(JSON.stringify(original));
  });

  it('hides the dropped key names while escaped', () => {
    const text = JSON.stringify(escaped(parseJson(DANGEROUS_JSON)));

    expect(text).not.toContain('"__proto__"');
    expect(text).not.toContain('"prototype"');
    expect(text).not.toContain('"constructor"');
  });

  it('restores __proto__ as an own property, not as the prototype', () => {
    const copy = escaped(parseJson(DANGEROUS_JSON));
    restoreKeys(copy);

    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
    expect(Object.getOwnPropertyNames(copy)).toContain('__proto__');
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    expect('polluted' in {}).toBe(false);
  });

  it('does not change the value it copies', () => {
    const original = parseJson(DANGEROUS_JSON);
    const before = JSON.stringify(original);

    escapeKeys(original);

    expect(JSON.stringify(original)).toBe(before);
  });

  it('returns the same data when no key needs escaping', () => {
    const plain = {a: [1, {b: 2}]};

    expect(escapeKeys(plain)).toEqual({
      ok: true,
      value: {value: plain, changed: false},
    });
    expect(escaped(plain)).toBe(plain);
  });

  it('leaves primitives and plain keys alone', () => {
    expect(escaped('text')).toBe('text');
    expect(escaped(null)).toBeNull();
    expect(escaped({a: [1, {b: 2}]})).toEqual({a: [1, {b: 2}]});
  });

  it('accepts data nested up to the limit', () => {
    expect(escapeKeys(nestedArrays(MAX_DEPTH + 1)).ok).toBe(true);
  });

  it('reports data nested past the limit instead of overflowing', () => {
    expect(escapeKeys(nestedArrays(MAX_DEPTH + 2)).ok).toBe(false);
    expect(escapeKeys(nestedArrays(200_000)).ok).toBe(false);
  });

  it(
    'copies and restores a very wide array and object without throwing',
    () => {
      const wideObject: Record<string, number> = {};
      for (let index = 0; index < WIDE_COUNT; index++) {
        wideObject[`key${index}`] = index;
      }
      Object.defineProperty(wideObject, 'constructor', {
        value: 1,
        enumerable: true,
      });
      const wide = {
        list: Array.from({length: WIDE_COUNT}, (_, i) => i),
        wideObject,
      };

      const copy = escaped(wide);
      restoreKeys(copy);

      expect(JSON.stringify(copy)).toBe(JSON.stringify(wide));
    },
    WIDE_TEST_TIMEOUT_MS,
  );

  it('reports data that refers to itself instead of looping', () => {
    const cyclic: Record<string, unknown> = {name: 'loop'};
    cyclic['self'] = cyclic;

    expect(escapeKeys(cyclic)).toEqual({
      ok: false,
      error: `Nested deeper than ${MAX_DEPTH} levels, or refers to itself`,
    });
  });
});

describe('restoreKeyPath', () => {
  it('restores each escaped segment of a dot path', () => {
    expect(restoreKeyPath('meta.\u0000constructor.0')).toBe(
      'meta.constructor.0',
    );
    expect(restoreKeyPath('slides.0.lines')).toBe('slides.0.lines');
  });
});
