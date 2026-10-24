import {describe, expect, it} from 'vitest';
import {escapeKeys, restoreKeyPath, restoreKeys} from './safeKeys';

const DANGEROUS_JSON =
  '{"a":1,"__proto__":{"polluted":true},"prototype":2,"constructor":3,' +
  '"list":[{"__proto__":4}],"\\u0000x":5}';
const MAX_DEPTH = 64;

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

function escaped(value: unknown): unknown {
  const result = escapeKeys(value);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
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
