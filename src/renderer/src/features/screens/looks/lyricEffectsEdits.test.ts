import {expect, it} from 'vitest';
import * as v from 'valibot';
import {looksSchema} from '@core/schema/looks';
import {DEFAULT_LYRIC_STYLE} from '@renderer/rendering/lyricStyle';
import {looksDocument} from '../testing/documents';
import {editLyricEffects} from '@core/looks/lyricEffectsEdits';

function fixture() {
  const document = looksDocument();
  if (document.name !== 'looks') throw new Error('Wrong fixture');
  return v.parse(looksSchema, {
    ...document.value,
    lyricStyles: [
      {
        ...DEFAULT_LYRIC_STYLE,
        id: '00000000-0000-4000-8000-000000000301',
        name: '기본',
        outline: {on: true, width: 3, color: '#000000', future: 'outline'},
        shadow: {
          on: true,
          blur: 8,
          distance: 4,
          angle: 45,
          opacity: 60,
          color: '#000000',
          future: 'shadow',
        },
        referencePosition: 'bottomRight',
        future: 'style',
      },
    ],
  });
}

it('merges successive changes and retains switched-off details and unknown fields', () => {
  const file = fixture();
  const style = file.lyricStyles[0];
  if (style === undefined) throw new Error('Missing style');
  const off = editLyricEffects(file, style.id, {
    kind: 'outline',
    change: {on: false},
  });
  if (off === undefined) throw new Error('Could not switch off');
  const width = editLyricEffects(off, style.id, {
    kind: 'outline',
    change: {width: 8},
  });
  if (width === undefined) throw new Error('Could not change width');
  const shadow = editLyricEffects(width, style.id, {
    kind: 'shadow',
    change: {angle: 180},
  });
  if (shadow === undefined) throw new Error('Could not change angle');
  const result = editLyricEffects(shadow, style.id, {
    kind: 'referencePosition',
    value: 'hidden',
  });
  expect(result?.lyricStyles[0]).toMatchObject({
    future: 'style',
    outline: {on: false, width: 8, color: '#000000', future: 'outline'},
    shadow: {on: true, blur: 8, angle: 180, future: 'shadow'},
    referencePosition: 'hidden',
  });
  expect(result?.looks).toBe(file.looks);
  expect(file.lyricStyles[0]?.outline.width).toBe(3);
});

it('rejects invalid values and skips a no-op', () => {
  const file = fixture();
  const style = file.lyricStyles[0];
  if (style === undefined) throw new Error('Missing style');
  expect(
    editLyricEffects(file, style.id, {kind: 'shadow', change: {angle: 361}}),
  ).toBeUndefined();
  expect(
    editLyricEffects(file, style.id, {kind: 'outline', change: {color: 'red'}}),
  ).toBeUndefined();
  expect(
    editLyricEffects(file, style.id, {kind: 'outline', change: {width: 3}}),
  ).toBe(file);
});
