import {describe, expect, it} from 'vitest';
import {escapeKeys, restoreKeyPath, restoreKeys} from './safeKeys';

const DANGEROUS_JSON =
  '{"a":1,"__proto__":{"polluted":true},"prototype":2,"constructor":3,' +
  '"list":[{"__proto__":4}],"\\u0000x":5}';

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

describe('escapeKeys and restoreKeys', () => {
  it('round-trips every key and keeps the key order', () => {
    const original = parseJson(DANGEROUS_JSON);

    const copy = escapeKeys(original);
    restoreKeys(copy);

    expect(JSON.stringify(copy)).toBe(JSON.stringify(original));
  });

  it('hides the dropped key names while escaped', () => {
    const escaped = escapeKeys(parseJson(DANGEROUS_JSON));

    expect(JSON.stringify(escaped)).not.toContain('"__proto__"');
    expect(JSON.stringify(escaped)).not.toContain('"prototype"');
    expect(JSON.stringify(escaped)).not.toContain('"constructor"');
  });

  it('restores __proto__ as an own property, not as the prototype', () => {
    const copy = escapeKeys(parseJson(DANGEROUS_JSON));
    restoreKeys(copy);

    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
    expect(Object.getOwnPropertyNames(copy)).toContain('__proto__');
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
  });

  it('does not change the value it copies', () => {
    const original = parseJson(DANGEROUS_JSON);
    const before = JSON.stringify(original);

    escapeKeys(original);

    expect(JSON.stringify(original)).toBe(before);
  });

  it('leaves primitives and plain keys alone', () => {
    expect(escapeKeys('text')).toBe('text');
    expect(escapeKeys(null)).toBeNull();
    expect(escapeKeys({a: [1, {b: 2}]})).toEqual({a: [1, {b: 2}]});
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
