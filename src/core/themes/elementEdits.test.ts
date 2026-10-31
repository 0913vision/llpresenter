import {expect, it} from 'vitest';
import {
  createMediaId,
  createScreenId,
  createThemeElementId,
} from '../schema/ids';
import {createDefaultThemes} from './defaults';
import {THEME_LIMITS, themeElementKinds} from './elementRules';
import {newThemeElement} from './newElement';
import {
  changeThemeElement,
  editThemeElements,
  hasThemeText,
  moveThemeElement,
  dropThemeElement,
  parseThemeClipboard,
  pasteThemeElements,
  serializeThemeClipboard,
} from './elementEdits';

it('accounts for the removed source row when dropping into an insertion boundary', () => {
  const values = [element('text', 1), element('text', 2), element('text', 3)];
  expect(
    dropThemeElement(values, elementId(1), 2).map(value => value.id),
  ).toEqual([elementId(2), elementId(1), elementId(3)]);
  expect(
    dropThemeElement(values, elementId(3), 1).map(value => value.id),
  ).toEqual([elementId(1), elementId(3), elementId(2)]);
});
import type {ThemeElement} from '../schema/themes';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const elementId = (index: number) => createThemeElementId(uuid(index));
function element(kind: ThemeElement['kind'], index = 1) {
  const value = newThemeElement({
    id: elementId(index),
    kind,
    mediaId: createMediaId(uuid(100)),
  });
  if (value === undefined) throw new Error('Missing element defaults');
  return value;
}

it.each(themeElementKinds)('creates valid defaults for %s', kind => {
  const value = element(kind);
  expect(value.kind).toBe(kind);
  expect(value.frame.x + value.frame.w).toBeLessThanOrEqual(THEME_LIMITS.width);
  expect(value.frame.y + value.frame.h).toBeLessThanOrEqual(
    THEME_LIMITS.height,
  );
  expect(hasThemeText(value)).toBe(
    !['media', 'background', 'overlay', 'image', 'box'].includes(kind),
  );
});

it('requires an image choice and clamps placement at the canvas edges', () => {
  expect(newThemeElement({id: elementId(1), kind: 'image'})).toBeUndefined();
  const value = newThemeElement({
    id: elementId(1),
    kind: 'text',
    point: {x: -100, y: 1200},
  });
  expect(value?.frame).toMatchObject({x: 0, y: 840});
  expect(
    newThemeElement({
      id: elementId(2),
      kind: 'text',
      point: {x: 515.253, y: 350.456},
    })?.frame,
  ).toEqual({x: 115.3, y: 230.5, w: 800, h: 240});
});

it('serializes positions and appearance, checks clipboard bounds and rejects foreign/malformed content', () => {
  const values = [element('currentText'), element('box', 2)];
  expect(parseThemeClipboard(serializeThemeClipboard(values))).toEqual(values);
  for (const text of [
    '{',
    '{}',
    JSON.stringify({format: 'other', elements: values}),
    'a'.repeat(1_000_001),
    serializeThemeClipboard(
      Array.from({length: 11}, (_, i) => element('text', i + 1)),
    ),
  ]) {
    expect(parseThemeClipboard(text)).toBeUndefined();
  }
});

it('pastes unique kinds in place and repeatable kinds with fresh identities and unchanged geometry', () => {
  const existing = element('currentText');
  const source = {
    ...element('currentText', 2),
    frame: {x: 100, y: 100, w: 600, h: 100},
  };
  const box = element('box', 3);
  const pasted = pasteThemeElements(
    [existing, box],
    [source, box],
    [elementId(8), elementId(9)],
  );
  expect(pasted).toEqual([
    {...source, id: existing.id},
    box,
    {...box, id: elementId(9)},
  ]);
  expect(
    moveThemeElement(pasted ?? [], box.id, 0).map(value => value.id),
  ).toEqual([box.id, existing.id, elementId(9)]);
});

it('checks edited elements, preserving other elements and rejecting identity changes', () => {
  const values = [element('text'), element('box', 2)];
  const changed = changeThemeElement(values, values[0]?.id ?? '', value => ({
    ...value,
    frame: {...value.frame, x: 1},
  }));
  expect(changed?.[1]).toBe(values[1]);
  expect(
    changeThemeElement(values, values[0]?.id ?? '', value => ({
      ...value,
      id: elementId(9),
    })),
  ).toBeUndefined();
});

it('refuses stage content on audience screens and live content in standby without partially applying paste', () => {
  const file = createDefaultThemes();
  const theme = file.themes[0];
  if (theme === undefined) throw new Error('Missing theme');
  const screen = {id: createScreenId(uuid(1)), kind: 'audience'} as const;
  const screens = [screen];
  expect(
    editThemeElements(file, {theme: theme.id, screen, screens}, values => [
      ...values,
      element('memo', 90),
    ]),
  ).toEqual({ok: false, error: 'elements'});
  expect(
    editThemeElements(file, {theme: file.standby.id, screen, screens}, () => [
      element('currentText'),
    ]).ok,
  ).toBe(false);
});
