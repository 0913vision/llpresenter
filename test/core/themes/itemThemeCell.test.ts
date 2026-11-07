import {expect, it} from 'vitest';
import {createServiceItemId, createSongId} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import {createDefaultThemes} from '@core/themes/defaults';
import {itemThemeCell} from '@core/themes/itemThemeCell';
import {newSlidesItem} from '@core/services/slidesEdits';

const ITEM_ID = createServiceItemId('00000000-0000-4000-8000-000000000101');
const SONG_ID = createSongId('00000000-0000-4000-8000-000000000201');
const file = createDefaultThemes();
const songTheme = file.themes[0];
if (songTheme === undefined) throw new Error('Expected a song theme');

it.each(['blank', 'ad'] as const)(
  'resolves the %s form default and an item override',
  form => {
    const item = newSlidesItem(form, ITEM_ID);
    expect(itemThemeCell(item, null)).toEqual({
      name: form === 'ad' ? '광고' : '말씀',
      followsDefault: true,
    });
    expect(itemThemeCell({...item, theme: songTheme.id}, file)).toEqual({
      name: songTheme.name,
      followsDefault: false,
    });
  },
);

function songItem(extra: object = {}): ServiceItem {
  return {slides: [], id: ITEM_ID, song: SONG_ID, ...extra};
}

it('shows the default of the kind, dim, for an item with no theme of its own', () => {
  expect(itemThemeCell(songItem(), file)).toEqual({
    name: songTheme.name,
    followsDefault: true,
  });
});

it('shows an own choice as not following the default', () => {
  const other = {...songTheme, id: file.themes[1]?.id ?? songTheme.id};
  const custom = {
    ...file,
    themes: [songTheme, {...other, name: '특송'}],
  };
  expect(itemThemeCell(songItem({theme: other.id}), custom)).toEqual({
    name: '특송',
    followsDefault: false,
  });
});

it('counts an explicit pick of the default theme as its own choice', () => {
  expect(itemThemeCell(songItem({theme: songTheme.id}), file)).toEqual({
    name: songTheme.name,
    followsDefault: false,
  });
});

it('falls back to the default when the chosen theme is gone', () => {
  expect(
    itemThemeCell(
      songItem({theme: '00000000-0000-4000-8000-0000000009ff'}),
      file,
    ),
  ).toEqual({name: songTheme.name, followsDefault: true});
});

it('has no cell for a header', () => {
  expect(itemThemeCell({id: ITEM_ID, header: '찬양'}, file)).toBeUndefined();
});
