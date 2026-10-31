import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  createThemeId,
  createThemeElementId,
  parseScreenId,
} from '../schema/ids';
import type {Theme, ThemeScreenLayout, ThemesFile} from '../schema/themes';
import {STARTER_LYRIC_STYLE} from '../looks/starterLayout';
import {expectSuccess} from '../schema/testHelpers';
import {builtInTheme, type ThemeScreen} from './defaults';
import {themeItemKinds} from './elementRules';
import {resolveItemTheme, resolveThemeScreen} from './resolve';

vi.mock('./defaults', () => ({builtInTheme: vi.fn()}));
beforeEach(() => vi.clearAllMocks());

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const first = expectSuccess(parseScreenId(uuid(1)));
const second = expectSuccess(parseScreenId(uuid(2)));
const third = expectSuccess(parseScreenId(uuid(3)));
const missing = expectSuccess(parseScreenId(uuid(4)));
const screens = [
  {id: first, kind: 'audience', method: 'fullscreen'},
  {id: second, kind: 'audience', method: 'capture'},
  {id: third, kind: 'stage', method: 'fullscreen'},
] as const satisfies readonly ThemeScreen[];
const own: ThemeScreenLayout = {
  mode: {kind: 'own'},
  elements: [],
  background: '#123456',
};
const same = (screen: typeof first): ThemeScreenLayout => ({
  mode: {kind: 'same', screen},
  elements: [],
});
const makeTheme = (layouts: Theme['screens']): Theme => ({
  id: createThemeId(uuid(5)),
  name: 'Example',
  screens: layouts,
});

describe('item theme selection', () => {
  const primary = makeTheme({});
  const alternate = {...primary, id: createThemeId(uuid(6))};
  const file: ThemesFile = {
    format: 'llsettings.themes',
    schemaVersion: 1,
    standby: {...primary, id: createThemeId(uuid(7))},
    themes: [primary, alternate],
    defaults: {
      song: primary.id,
      bible: primary.id,
      notice: primary.id,
      media: primary.id,
    },
  };
  const selected = alternate.id;
  const base = {file, kind: 'song', source: 'service', screens} as const;

  it('prefers an item selection, then its kind default', () => {
    expect(resolveItemTheme({...base, theme: selected}).id).toBe(selected);
    expect(resolveItemTheme(base).id).toBe(file.defaults.song);
    expect(
      resolveItemTheme({...base, theme: createThemeId(uuid(999))}).id,
    ).toBe(file.defaults.song);
  });

  it('ignores an item selection on an external slide', () => {
    expect(
      resolveItemTheme({...base, source: 'external', theme: selected}).id,
    ).toBe(file.defaults.song);
  });

  it.each(themeItemKinds)(
    'uses the %s builtin for missing, unreadable, or broken defaults',
    kind => {
      const fallback = {...primary, id: createThemeId(uuid(8))};
      vi.mocked(builtInTheme).mockReturnValue(fallback);
      for (const file of [
        null,
        undefined,
        {...base.file, defaults: {}},
        {...base.file, themes: []},
      ]) {
        expect(resolveItemTheme({...base, kind, file})).toBe(fallback);
        expect(builtInTheme).toHaveBeenLastCalledWith(kind, screens);
      }
    },
  );
});

describe('screen links', () => {
  it('resolves a chain to the live source layout', () => {
    const theme = makeTheme({
      [first]: same(second),
      [second]: same(third),
      [third]: own,
    });
    expect(resolveThemeScreen(theme, first, screens)).toEqual({
      sourceScreenId: third,
      layout: own,
    });
    const edited = {...own, background: '#654321'};
    expect(
      resolveThemeScreen(
        {...theme, screens: {...theme.screens, [third]: edited}},
        first,
        screens,
      ),
    ).toEqual({sourceScreenId: third, layout: edited});
  });

  it.each([
    {},
    {[first]: same(first)},
    {[first]: same(second), [second]: same(first)},
    {[first]: same(missing), [missing]: own},
    {[first]: {mode: {kind: 'empty'}, elements: []}},
  ] satisfies ReadonlyArray<Theme['screens']>)(
    'makes missing entries, loops, and empty modes empty: %j',
    layouts => {
      expect(resolveThemeScreen(makeTheme(layouts), first, screens)).toEqual({
        sourceScreenId: first,
        layout: {mode: {kind: 'empty'}, elements: []},
      });
    },
  );

  it('makes a missing destination empty even if the file retains its layout', () => {
    expect(
      resolveThemeScreen(makeTheme({[missing]: own}), missing, screens).layout
        .mode.kind,
    ).toBe('empty');
  });

  it('retains the source of inherited colors for empty or omitted linked layouts', () => {
    const empty: ThemeScreenLayout = {
      mode: {kind: 'empty'},
      elements: [],
      background: '#FFFFFF',
    };
    for (const layout of [undefined, empty]) {
      const theme = makeTheme({
        [first]: same(second),
        ...(layout === undefined ? {} : {[second]: layout}),
      });
      expect(resolveThemeScreen(theme, first, screens)).toEqual({
        sourceScreenId: second,
        layout: {mode: {kind: 'empty'}, elements: []},
      });
    }
  });

  it('refuses stage content on an audience destination, including linked layouts', () => {
    const stage: ThemeScreenLayout = {
      mode: {kind: 'own'},
      elements: [
        {
          id: createThemeElementId(uuid(9)),
          kind: 'stageMessage',
          frame: {x: 0, y: 0, w: 1920, h: 1080},
          text: STARTER_LYRIC_STYLE,
        },
      ],
    };
    const theme = makeTheme({
      [first]: same(third),
      [third]: stage,
    });
    expect(resolveThemeScreen(theme, first, screens).layout.mode.kind).toBe(
      'empty',
    );
    expect(resolveThemeScreen(theme, third, screens)).toEqual({
      sourceScreenId: third,
      layout: stage,
    });
  });
});
