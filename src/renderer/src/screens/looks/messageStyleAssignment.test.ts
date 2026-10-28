import {expect, it} from 'vitest';
import * as v from 'valibot';
import {DEFAULT_MESSAGE_STYLE, looksSchema} from '@shared/schema/looks';
import {looksDocument, screensDocument} from '../testing/documents';
import {
  assignMessageStyle,
  createAndAssignMessageStyle,
} from './messageStyleAssignment';
import {parseMessageStyleId} from '@shared/schema/ids';

function fixture() {
  const looks = looksDocument();
  const screens = screensDocument();
  if (looks.name !== 'looks' || screens.name !== 'screens') {
    throw new Error('Wrong fixture');
  }
  const file = v.parse(looksSchema, {
    ...looks.value,
    messageStyles: [
      DEFAULT_MESSAGE_STYLE,
      {
        ...DEFAULT_MESSAGE_STYLE,
        id: '00000000-0000-4000-8000-000000000002',
        name: '방송용',
      },
    ],
  });
  const look = file.looks[0];
  const first = screens.value.screens[0];
  const second = screens.value.screens[1];
  const style = file.messageStyles?.[1];
  if (
    look === undefined ||
    first === undefined ||
    second === undefined ||
    style === undefined
  ) {
    throw new Error('Missing fixture');
  }
  return {file, look, first, second, style};
}

it('assigns one screen while preserving other screens, looks, and missing-card visibility', () => {
  const {file, look, first, second, style} = fixture();
  const before = {
    ...file,
    looks: file.looks.map(item =>
      item.id === look.id
        ? {
            ...item,
            screens: {
              ...item.screens,
              [second.id]: {layers: {message: true}, future: 'keep'},
            },
          }
        : item,
    ),
  };
  const next = assignMessageStyle(before, {
    lookId: look.id,
    screenId: first.id,
    styleId: style.id,
  });
  expect(next.looks[0]?.screens[first.id]).toMatchObject({
    messageStyle: style.id,
    layers: {media: true, slide: true, message: true},
  });
  expect(next.looks[0]?.screens[second.id]).toEqual({
    layers: {message: true},
    future: 'keep',
  });
  expect(next.looks[1]).toBe(before.looks[1]);
  const cleared = assignMessageStyle(next, {
    lookId: look.id,
    screenId: first.id,
    styleId: null,
  });
  expect(cleared.looks[0]?.screens[first.id]?.messageStyle).toBeUndefined();
  expect(cleared.looks[0]?.screens[first.id]?.layers).toEqual(
    next.looks[0]?.screens[first.id]?.layers,
  );
});

it('ignores missing style targets and unchanged assignments', () => {
  const {file, look, first, style} = fixture();
  expect(
    assignMessageStyle(file, {
      lookId: look.id,
      screenId: first.id,
      styleId: null,
    }),
  ).toBe(file);
  const assigned = assignMessageStyle(file, {
    lookId: look.id,
    screenId: first.id,
    styleId: style.id,
  });
  expect(
    assignMessageStyle(assigned, {
      lookId: look.id,
      screenId: first.id,
      styleId: style.id,
    }),
  ).toBe(assigned);
  expect(
    assignMessageStyle(
      {...file, messageStyles: []},
      {lookId: look.id, screenId: first.id, styleId: style.id},
    ).looks,
  ).toBe(file.looks);
});

it('creates and assigns a distinct copy without changing another screen', () => {
  const {file, look, first, second, style} = fixture();
  const id = parseMessageStyleId('00000000-0000-4000-8000-000000000003');
  if (!id.ok) throw new Error('Bad fixture id');
  const assigned = assignMessageStyle(file, {
    lookId: look.id,
    screenId: first.id,
    styleId: style.id,
  });
  const created = createAndAssignMessageStyle(assigned, {
    lookId: look.id,
    screenId: first.id,
    styleId: id.value,
  });
  expect(created.messageStyles?.at(-1)).toMatchObject({
    ...style,
    id: id.value,
    name: '새 메시지 스타일',
  });
  expect(created.looks[0]?.screens[first.id]?.messageStyle).toBe(id.value);
  expect(created.looks[0]?.screens[second.id]).toEqual(
    assigned.looks[0]?.screens[second.id],
  );
  expect(
    createAndAssignMessageStyle(created, {
      lookId: look.id,
      screenId: first.id,
      styleId: id.value,
    }),
  ).toBe(created);
});
