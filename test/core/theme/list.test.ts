import {describe, expect, it} from 'vitest';
import {createThemeId} from '@core/schema/ids';
import {THEMES_LIMITS, type Themes} from '@core/schema/themes';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {
  copiedThemeName,
  editThemeList,
  newTheme,
  ownThemeCount,
  type ThemeListEdit,
} from '@core/theme/list';
import {themeFor, themeOfSlide} from '@core/theme/themes';
import {themes} from '@fixtures/core/themeOutput';

const LYRICS = BUILT_IN_THEME_IDS.lyrics;
const own = (number: number) =>
  createThemeId(`70000000-0000-4000-8000-${String(number).padStart(12, '0')}`);

function edited(list: Themes, edit: ThemeListEdit): Themes {
  const result = editThemeList(list, edit);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function withOwn(number = 1): Themes {
  const list = themes();
  const theme = {...newTheme(list, 'lyrics', own(number)), name: '내 가사'};
  return edited(list, {kind: 'add', theme, after: LYRICS});
}

describe('editThemeList', () => {
  it('puts a new theme after another and refuses its name twice', () => {
    const list = withOwn();
    const at = list.themes.findIndex(theme => theme.id === own(1));
    expect(list.themes[at - 1]?.id).toBe(LYRICS);
    expect(ownThemeCount(list)).toBe(1);
    expect(
      editThemeList(list, {
        kind: 'add',
        theme: {...newTheme(list, 'lyrics', own(2)), name: '내 가사'},
        after: LYRICS,
      }),
    ).toEqual({ok: false, error: 'taken'});
  });

  it('refuses a theme over the cap', () => {
    const list = withOwn();
    const theme = list.themes.find(entry => entry.id === own(1));
    if (theme === undefined) throw new Error('No theme');
    const full = {
      ...list,
      themes: [
        ...list.themes,
        ...Array.from({length: THEMES_LIMITS.themes - 1}, (_, index) => ({
          ...theme,
          id: own(index + 10),
          name: `테마 ${index}`,
        })),
      ],
    };
    expect(
      editThemeList(full, {
        kind: 'add',
        theme: {...theme, id: own(999), name: '하나 더'},
        after: LYRICS,
      }),
    ).toEqual({ok: false, error: 'full'});
  });

  it('refuses an empty name', () => {
    expect(
      editThemeList(themes(), {kind: 'rename', id: LYRICS, name: ' '}),
    ).toEqual({ok: false, error: 'name'});
  });

  it('brings back a changed theme of the app, and never deletes it', () => {
    const list = edited(themes(), {kind: 'rename', id: LYRICS, name: '가사'});
    expect(edited(list, {kind: 'restore', id: LYRICS})).toEqual(themes());
    expect(editThemeList(list, {kind: 'delete', id: LYRICS})).toEqual({
      ok: false,
      error: 'own',
    });
  });

  it('forgets the default when its theme is deleted', () => {
    const list = edited(withOwn(), {kind: 'default', id: own(1)});
    expect(themeFor(list, 'lyrics').id).toBe(own(1));
    const without = edited(list, {kind: 'delete', id: own(1)});
    expect(themeFor(without, 'lyrics').id).toBe(LYRICS);
  });

  it('moves a theme to a place in the list', () => {
    const list = edited(themes(), {kind: 'move', id: LYRICS, before: null});
    expect(list.themes.at(-1)?.id).toBe(LYRICS);
  });
});

describe('copiedThemeName', () => {
  it('is free', () => {
    const list = themes();
    const name = copiedThemeName(list, '찬양 가사');
    expect(name).not.toBe('찬양 가사');
    expect(list.themes.some(theme => theme.name === name)).toBe(false);
  });
});

describe('themeOfSlide', () => {
  const gone = own(404);

  it('draws a slide of a deleted theme with one that has its boxes', () => {
    expect(themeOfSlide(null, {theme: gone, texts: {가사: '하늘'}}).id).toBe(
      LYRICS,
    );
    expect(
      themeOfSlide(null, {theme: gone, texts: {제목: '찬양', 영문: 'Praise'}})
        .purpose,
    ).toBe('title');
  });

  it('draws a slide without texts as a blank one', () => {
    expect(themeOfSlide(null, {theme: gone, texts: {}}).purpose).toBe('blank');
  });
});
