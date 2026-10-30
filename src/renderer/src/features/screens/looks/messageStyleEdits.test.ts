import {expect, it} from 'vitest';
import * as v from 'valibot';
import {DEFAULT_MESSAGE_STYLE, looksSchema} from '@core/schema/looks';
import {looksDocument} from '../testing/documents';
import {editMessageStyle} from '@core/looks/messageStyleEdits';

function fixture() {
  const doc = looksDocument();
  if (doc.name !== 'looks') throw new Error('Wrong fixture');
  return v.parse(looksSchema, {
    ...doc.value,
    messageStyles: [
      {
        ...DEFAULT_MESSAGE_STYLE,
        future: 'style',
        shadow: {...DEFAULT_MESSAGE_STYLE.shadow, future: 'shadow'},
      },
    ],
  });
}

it('merges independent changes and preserves unknown fields and unrelated Looks', () => {
  const file = fixture();
  const id = DEFAULT_MESSAGE_STYLE.id;
  const first = editMessageStyle(file, id, {kind: 'text', change: {size: 120}});
  if (first === undefined) throw new Error('Missing first edit');
  const second = editMessageStyle(first, id, {
    kind: 'shadow',
    change: {angle: 200},
  });
  if (second === undefined) throw new Error('Missing second edit');
  const third = editMessageStyle(second, id, {
    kind: 'shadow',
    change: {on: false},
  });
  expect(third?.messageStyles?.[0]).toMatchObject({
    size: 120,
    future: 'style',
    shadow: {on: false, angle: 200, blur: 8, future: 'shadow'},
  });
  expect(third?.looks).toBe(file.looks);
  expect(file.messageStyles?.[0]?.size).toBe(DEFAULT_MESSAGE_STYLE.size);
});

it('rejects invalid changes and returns the same file for a no-op', () => {
  const file = fixture();
  const id = DEFAULT_MESSAGE_STYLE.id;
  expect(
    editMessageStyle(file, id, {kind: 'text', change: {color: 'red'}}),
  ).toBeUndefined();
  expect(
    editMessageStyle(file, id, {kind: 'shadow', change: {angle: 361}}),
  ).toBeUndefined();
  expect(
    editMessageStyle(file, id, {
      kind: 'text',
      change: {size: DEFAULT_MESSAGE_STYLE.size},
    }),
  ).toBe(file);
});
