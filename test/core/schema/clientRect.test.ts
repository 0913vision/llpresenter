import {describe, expect, it} from 'vitest';
import {parseClientRectJson} from '@core/schema/clientRect';

describe('parseClientRectJson', () => {
  it('accepts the box of an element and drops unknown fields', () => {
    const text = JSON.stringify({
      left: 0,
      top: 1,
      right: 2,
      bottom: 3,
      width: 2,
    });

    expect(parseClientRectJson(text)).toEqual({
      ok: true,
      value: {left: 0, top: 1, right: 2, bottom: 3},
    });
  });

  it.each([
    ['not text', 5],
    ['not JSON', '{'],
    ['null', 'null'],
    ['a missing side', JSON.stringify({left: 0, top: 1, right: 2})],
    ['a text side', JSON.stringify({left: 'a', top: 1, right: 2, bottom: 3})],
  ])('rejects %s', (_name, value) => {
    expect(parseClientRectJson(value).ok).toBe(false);
  });
});
