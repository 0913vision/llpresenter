import {describe, expect, it} from 'vitest';
import {createThemeId} from '../schema/ids';
import {checkPart} from '../schema/fileFormat';
import {serviceSchema, type ServiceItem} from '../schema/service';
import {itemUsesTheme} from './themeUsage';

const THEME = createThemeId('00000000-0000-4000-8000-000000000a01');
const OTHER = createThemeId('00000000-0000-4000-8000-000000000a02');
const itemId = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

function items(...raw: ReadonlyArray<Record<string, unknown>>): ServiceItem[] {
  const parsed = checkPart(serviceSchema, {
    format: 'llservice',
    schemaVersion: 1,
    id: itemId(900),
    name: 'Invented service',
    date: '2026-01-04T10:00',
    order: raw,
  });
  if (!parsed.ok) throw new Error('Invalid invented service');
  return [...parsed.value.order];
}

describe('item theme usage', () => {
  const [chosen, defaulted, other, header, overridden] = items(
    {id: itemId(1), song: itemId(11), theme: THEME},
    {id: itemId(2), song: itemId(12)},
    {id: itemId(3), song: itemId(13), theme: OTHER},
    {id: itemId(4), header: 'Invented header'},
    {id: itemId(5), media: itemId(15)},
  );
  const defaults = {song: THEME};

  it.each([
    ['an item that chose the theme', chosen, true],
    ['an item that follows its kind default', defaulted, true],
    ['an item that chose another theme', other, false],
    ['an item of a kind with no theme', header, false],
    ['an item whose kind default is another theme', overridden, false],
  ])('answers for %s', (_name, item, expected) => {
    if (item === undefined) throw new Error('Missing invented item');
    expect(itemUsesTheme(item, THEME, defaults)).toBe(expected);
  });
});
