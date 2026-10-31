import {describe, expect, it} from 'vitest';
import {createThemeId} from '../schema/ids';
import type {Theme} from '../schema/themes';
import {
  THEME_MAIN,
  THEME_CAPTURE,
  themeFile,
  themeScreens,
} from '../testing/themeOutput';
import {resolveThemeOutput} from './output';

describe('published theme compositions', () => {
  it('publishes standby and each screen empty color when there is no item', () => {
    const file = themeFile();
    const output = resolveThemeOutput({
      file,
      screens: themeScreens,
      item: null,
      revision: 1,
    });
    expect(output?.themeId).toBe(file.standby.id);
    expect(output?.screens[THEME_MAIN]).toMatchObject({
      emptyColor: '#123456',
      layout: {mode: {kind: 'empty'}},
    });
    expect(output?.screens[THEME_CAPTURE]?.emptyColor).toBe('#00B140');
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
    expect(output?.screens[THEME_CAPTURE]).toMatchObject({
      sourceScreenId: THEME_MAIN,
      emptyColor: '#123456',
    });
    expect(output?.screens[THEME_CAPTURE]?.layout).toBe(
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
    expect(output?.missing).toEqual([missing, missing]);
    expect(
      output?.screens[THEME_MAIN]?.layout.elements.some(
        element => element.kind === 'currentText',
      ),
    ).toBe(true);
  });

  it('uses built-in Bible references before themes load and supports explicit legacy Looks', () => {
    const request = {
      file: null,
      screens: themeScreens,
      item: {id: 'external', kind: 'bible', source: 'external'} as const,
      revision: 0,
    };
    const output = resolveThemeOutput(request);
    expect(
      output?.screens[THEME_MAIN]?.layout.elements.some(
        element => element.kind === 'reference',
      ),
    ).toBe(true);
    expect(
      resolveThemeOutput({...request, mode: {kind: 'legacy'}}),
    ).toBeUndefined();
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
    expect(output?.themeId).toBe(file.defaults.song);
    expect(output?.missing).toHaveLength(1);
  });
});
