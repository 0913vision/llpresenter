import {expect, it} from 'vitest';
import * as v from 'valibot';
import {itemOverlaySchema, itemOverlaysSchema} from './itemOverlays';
import {parseService} from './service';
import {expectSuccess} from './testHelpers';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const overlay = {
  id: uuid(1),
  name: 'Example',
  from: 1,
  to: 2,
  screens: [uuid(2)],
  content: {text: 'Example'},
};

it('accepts text and media sources, retaining unknown fields', () => {
  for (const content of [
    {text: ''},
    {media: uuid(3), loop: false, sound: true},
  ]) {
    const input = {...overlay, content: {...content, future: 1}};
    expect(v.parse(itemOverlaySchema, input)).toEqual(input);
  }
});

it.each([
  {content: {}},
  {content: {media: 'missing', loop: true, sound: false}},
  {content: {media: uuid(3), loop: true}},
  {content: {media: uuid(3), loop: 'yes', sound: false}},
  {content: {media: uuid(3), loop: true, sound: 0}},
  {content: {media: uuid(3), loop: true, sound: false, text: 'Ambiguous'}},
  {name: ' '},
  {name: 'x'.repeat(81)},
  {from: 0},
  {to: 0},
  {from: 1.5},
  {to: Infinity},
  {to: Number.MAX_SAFE_INTEGER + 1},
  {from: 3},
  {screens: ['main']},
  {screens: [uuid(2), uuid(2)]},
])('rejects invalid overlay properties %j', patch => {
  expect(v.safeParse(itemOverlaySchema, {...overlay, ...patch}).success).toBe(
    false,
  );
});

it('bounds screens and allows an empty target list', () => {
  const screens = Array.from({length: 200}, (_, n) => uuid(n));
  for (const targets of [[], screens]) {
    expect(
      v.safeParse(itemOverlaySchema, {...overlay, screens: targets}).success,
    ).toBe(true);
  }
  expect(
    v.safeParse(itemOverlaySchema, {
      ...overlay,
      screens: [...screens, uuid(201)],
    }).success,
  ).toBe(false);
});

it('bounds overlay counts and requires unique identities', () => {
  const overlays = Array.from({length: 50}, (_, n) => ({
    ...overlay,
    id: uuid(n),
    from: n + 1,
    to: n + 1,
  }));
  expect(v.safeParse(itemOverlaysSchema, overlays).success).toBe(true);
  expect(
    v.safeParse(itemOverlaysSchema, [
      ...overlays,
      {...overlay, id: uuid(51), from: 51, to: 51},
    ]).success,
  ).toBe(false);
  expect(
    v.safeParse(itemOverlaysSchema, [overlay, {...overlay, from: 3, to: 3}])
      .success,
  ).toBe(false);
});

it('validates service item extensions while accepting older items', () => {
  const item = {id: uuid(4), media: uuid(5)};
  const file = {
    format: 'llservice',
    schemaVersion: 1,
    id: uuid(6),
    name: 'Example',
    date: '2026-10-31T10:00',
    order: [item],
  };
  const parse = (order: unknown[]) =>
    parseService(JSON.stringify({...file, order}), 'service.llservice');
  expect(parse([item]).ok).toBe(true);
  const extended = {...item, theme: uuid(7), overlays: [overlay]};
  expect(expectSuccess(parse([extended])).data.order).toEqual([extended]);
  expect(parse([{...item, theme: 'missing'}]).ok).toBe(false);
  expect(
    parse([{...extended, overlays: [overlay, {...overlay, id: uuid(8)}]}]).ok,
  ).toBe(false);
});
