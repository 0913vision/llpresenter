import {expect, it} from 'vitest';
import * as v from 'valibot';
import {itemOverlaySchema} from '@core/schema/services/itemOverlays';

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
