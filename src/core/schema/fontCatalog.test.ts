import {expect, it} from 'vitest';
import {fontFamilyFixture} from '@contracts/ipc/testing/fontCatalog';
import {FONT_CATALOG_LIMITS, parseFontCatalog} from './fontCatalog';

it('keeps localized names and nonstandard OpenType weights and drops unknown fields', () => {
  const fixture = fontFamilyFixture();
  expect(parseFontCatalog([{...fixture, future: true}])).toEqual({
    ok: true,
    value: [fixture],
  });
});

const family = fontFamilyFixture();
it.each([
  {name: 'null', value: null},
  {name: 'an object list', value: {}},
  {name: 'a null family', value: [null]},
  {name: 'a blank family', value: [{...family, family: ' '}]},
  {name: 'control characters', value: [{...family, label: 'bad\nname'}]},
  {
    name: 'long names',
    value: [{...family, family: 'x'.repeat(FONT_CATALOG_LIMITS.name + 1)}],
  },
  {
    name: 'too many aliases',
    value: [
      {
        ...family,
        aliases: Array(FONT_CATALOG_LIMITS.aliases + 1).fill('alias'),
      },
    ],
  },
  {name: 'empty weights', value: [{...family, weights: []}]},
  {name: 'a zero weight', value: [{...family, weights: [0]}]},
  {name: 'a large weight', value: [{...family, weights: [1001]}]},
  {name: 'a fractional weight', value: [{...family, weights: [400.5]}]},
  {name: 'a non-number weight', value: [{...family, weights: [Number.NaN]}]},
  {
    name: 'too many weights',
    value: [
      {...family, weights: Array(FONT_CATALOG_LIMITS.weights + 1).fill(400)},
    ],
  },
  {
    name: 'too many families',
    value: Array(FONT_CATALOG_LIMITS.families + 1).fill(family),
  },
])('refuses $name', ({value}) => {
  expect(parseFontCatalog(value).ok).toBe(false);
});

it('accepts the numeric weight boundaries', () => {
  expect(parseFontCatalog([{...family, weights: [1, 1000]}]).ok).toBe(true);
});
