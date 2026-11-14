import {describe, expect, it} from 'vitest';
import {createThemeId} from '@core/schema/ids';
import type {Theme} from '@core/schema/themes';
import {
  THEME_MAIN,
  THEME_CAPTURE,
  themeFile,
  themeScreens,
} from '@fixtures/core/themeOutput';
import {resolveThemeOutput} from '@core/themes/output';
import {SUNDAY_STANDBY_PICTURE_IDS} from '@core/themes/sundayStandby';

describe('published theme compositions', () => {
  it('publishes the resolved theme transition to output', () => {
    const file = themeFile();
    const theme = file.themes[0];
    if (theme === undefined) throw new Error('Missing theme');
    const transition = {kind: 'wipe' as const, sec: 0.7};
    const output = resolveThemeOutput({
      file: {
        ...file,
        themes: [{...theme, transition}],
        defaults: {...file.defaults, song: theme.id},
      },
      screens: themeScreens,
      item: {id: 'song', kind: 'song', source: 'service'},
      revision: 1,
    });
    expect(output.transition).toEqual(transition);
  });

  it('resolves titles for saved built-in song themes while retaining lyric edits and other roles', () => {
    const file = themeFile();
    const song = file.themes.find(theme => theme.id === file.defaults.song);
    const audience = song?.screens[THEME_MAIN];
    if (song === undefined || audience === undefined) {
      throw new Error('Missing song theme');
    }
    const {songTitle: removed, ...legacy} = audience;
    const saved: Theme = {
      ...song,
      screens: {...song.screens, [THEME_MAIN]: legacy},
    };
    const output = resolveThemeOutput({
      file: {...file, themes: [saved]},
      screens: themeScreens,
      item: {id: 'song', kind: 'song', source: 'service'},
      revision: 1,
    });
    expect(output.screens[THEME_MAIN]?.layout.songTitle).toBe('sunday');
    expect(output.screens[THEME_MAIN]?.layout.elements).toEqual(
      legacy.elements,
    );
    expect(output.screens[THEME_CAPTURE]?.layout.songTitle).toBeUndefined();
    expect(saved.screens[THEME_MAIN]).not.toHaveProperty('songTitle');
  });
  it('publishes standby and each screen empty color when there is no item', () => {
    const file = themeFile();
    const output = resolveThemeOutput({
      file,
      screens: themeScreens,
      item: null,
      revision: 1,
    });
    expect(output.themeId).toBe(file.standby.id);
    expect(output.screens[THEME_MAIN]).toMatchObject({
      emptyColor: '#123456',
      layout: {mode: {kind: 'own'}},
    });
    expect(output.screens[THEME_MAIN]?.layout.elements[0]).toMatchObject({
      kind: 'image',
      mediaId: SUNDAY_STANDBY_PICTURE_IDS.serviceTimesBright,
    });
    expect(output.screens[THEME_CAPTURE]?.layout.elements).toEqual([]);
    expect(output.screens[THEME_CAPTURE]?.emptyColor).toBe('#00B140');
  });

  it('gives a 무대 화면 without a 대기 화면 layout a clock and a timer', () => {
    const stage = themeScreens.find(screen => screen.kind === 'stage');
    if (stage === undefined) throw new Error('Missing stage screen');
    const file = themeFile();
    const output = resolveThemeOutput({
      file: {...file, standby: {...file.standby, screens: {}}},
      screens: themeScreens,
      item: null,
      revision: 1,
    });
    expect(output.screens[stage.id]?.layout.elements.map(e => e.kind)).toEqual([
      'clock',
      'timer',
    ]);
    expect(output.screens[THEME_MAIN]?.layout.mode.kind).toBe('empty');
  });

  it('inherits the linked source composition and its configured empty color', () => {
    const file = themeFile();
    const first = file.themes[0];
    if (first === undefined) throw new Error('Missing starter theme');
    const linked: Theme = {
      ...first,
      screens: {
        ...first.screens,
        [THEME_CAPTURE]: {
          mode: {kind: 'same', screen: THEME_MAIN},
          elements: [],
        },
      },
    };
    const output = resolveThemeOutput({
      file: {...file, themes: [linked]},
      screens: themeScreens,
      item: {id: 'service', kind: 'song', source: 'service'},
      revision: 2,
    });
    expect(output.screens[THEME_CAPTURE]).toMatchObject({
      sourceScreenId: THEME_MAIN,
      emptyColor: '#123456',
    });
    expect(output.screens[THEME_CAPTURE]?.layout).toBe(
      linked.screens[THEME_MAIN],
    );
  });

  it('publishes usable built-in content and diagnostics for both missing theme references', () => {
    const missing = createThemeId('00000000-0000-4000-8000-000000000999');
    const output = resolveThemeOutput({
      file: {...themeFile(), themes: [], defaults: {song: missing}},
      screens: themeScreens,
      item: {id: 'service', kind: 'song', source: 'service', theme: missing},
      revision: 3,
    });
    expect(output.missing).toEqual([missing, missing]);
    expect(
      output.screens[THEME_MAIN]?.layout.elements.some(
        element => element.kind === 'currentText',
      ),
    ).toBe(true);
  });

  it('uses built-in Bible references before themes load', () => {
    const request = {
      file: null,
      screens: themeScreens,
      item: {id: 'external', kind: 'bible', source: 'external'} as const,
      revision: 0,
    };
    const output = resolveThemeOutput(request);
    expect(
      output.screens[THEME_MAIN]?.layout.elements.some(
        element => element.kind === 'reference',
      ),
    ).toBe(true);
  });

  it('falls back from a missing manual choice to the kind default rather than the service override', () => {
    const file = themeFile();
    const override = file.defaults.bible;
    if (override === undefined) throw new Error('Missing theme');
    const output = resolveThemeOutput({
      file,
      screens: themeScreens,
      revision: 1,
      item: {id: 'song', kind: 'song', source: 'service', theme: override},
      mode: {
        kind: 'manual',
        id: createThemeId('00000000-0000-4000-8000-000000000999'),
      },
    });
    expect(output.themeId).toBe(file.defaults.song);
    expect(output.missing).toHaveLength(1);
  });
});
