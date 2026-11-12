import {expect, it} from 'vitest';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {parseThemes, serializeThemes} from '@core/schema/themes';
import {builtInTheme, createDefaultThemes} from '@core/themes/defaults';
import {LIGHT_SONG_THEME_ID} from '@core/themes/lightSong';
import {resolveThemeOutput} from '@core/themes/output';
import {songTitleLayout} from '@core/themes/songTitle';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {themeScreens, THEME_MAIN} from '@fixtures/core/themeOutput';

it('offers native-width dark audience lyrics while retaining the white song frame, pictures, and other roles', () => {
  const audience = createScreenId('00000000-0000-4000-8000-000000000999');
  const screens = [
    ...themeScreens,
    {id: audience, kind: 'audience', method: 'fullscreen'} as const,
  ];
  const file = createDefaultThemes(screens);
  const song = builtInTheme('song', screens);
  const light = file.themes.find(theme => theme.id === LIGHT_SONG_THEME_ID);
  expect(file.defaults.song).toBe(song.id);
  expect(light?.name).toBe('찬양 (밝은 배경)');
  for (const screen of screens) {
    const original = song.screens[screen.id];
    const variant = light?.screens[screen.id];
    if (screen.kind !== 'audience') {
      expect(variant).toEqual(original);
      continue;
    }
    expect(variant?.songTitle).toBe('sunday-light');
    expect(variant?.background).toBe('#FFFFFF');
    expect(original?.background).toBeUndefined();
    expect(
      variant?.elements.find(element => element.kind === 'currentText')?.frame,
    ).toEqual({x: 36, y: 141, w: 1848, h: 411});
    expect(
      file.themes
        .find(theme => theme.id === file.defaults.song)
        ?.screens[screen.id]?.elements.find(
          element => element.kind === 'currentText',
        )?.frame,
    ).toEqual({x: 132, y: 141, w: 1656, h: 411});
    expect(variant?.elements).toEqual(
      original?.elements.map(element =>
        element.kind === 'currentText'
          ? {
              ...element,
              frame: {...element.frame, x: 36, w: 1848},
              text: {...element.text, color: '#000000'},
            }
          : element,
      ),
    );
  }
});

it('retains dark title composition through copying, saving, and item selection', () => {
  const file = createDefaultThemes(themeScreens);
  const light = file.themes.find(theme => theme.id === LIGHT_SONG_THEME_ID);
  if (light === undefined) throw new Error('Missing light song theme');
  const copy = {
    ...light,
    id: createThemeId('00000000-0000-4000-8000-000000000998'),
    name: 'Copied theme',
  };
  const serialized = expectSuccess(
    serializeThemes({...file, themes: [...file.themes, copy]}, 'themes.json'),
  );
  const saved = expectSuccess(parseThemes(serialized, 'themes.json')).data;
  const output = resolveThemeOutput({
    file: saved,
    screens: themeScreens,
    item: {id: 'invented', kind: 'song', source: 'service', theme: copy.id},
    revision: 1,
  });
  expect(output.themeId).toBe(copy.id);
  const layout = output.screens[THEME_MAIN]?.layout;
  if (layout === undefined) throw new Error('Missing audience layout');
  const slide = {
    itemId: 'invented',
    position: 0,
    label: null,
    lines: ['Invented title', 'Optional subtitle'],
    titleSlide: true,
  } as const;
  const composed = songTitleLayout(layout, slide);
  expect(composed.elements.slice(0, 2)).toEqual(layout.elements.slice(0, 2));
  expect(composed.elements.slice(2)).toMatchObject([
    {
      kind: 'text',
      content: 'Invented title',
      clearTarget: 'slide',
      frame: {x: 339, y: 181, w: 1242, h: 160},
      text: {
        color: '#000000',
        size: 120,
        weight: 800,
        shadow: {on: false},
        outline: {on: false},
      },
    },
    {
      kind: 'text',
      content: 'Optional subtitle',
      clearTarget: 'slide',
      text: {color: '#000000', size: 64, weight: 400, tracking: 24},
    },
  ]);
  expect(
    songTitleLayout(layout, {...slide, lines: ['Invented title']}).elements.at(
      -1,
    ),
  ).toMatchObject({content: ''});
  const {titleSlide: removed, ...lyrics} = slide;
  expect(songTitleLayout(layout, lyrics)).toBe(layout);
});
