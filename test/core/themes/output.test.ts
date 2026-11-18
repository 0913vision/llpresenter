import {describe, expect, it} from 'vitest';
import {createThemeId} from '@core/schema/ids';
import type {Theme} from '@core/schema/themes';
import {
  THEME_MAIN,
  THEME_CAPTURE,
  THEME_STAGE,
  themeFile,
  themeScreens,
  fixedThemeText,
} from '@fixtures/core/themeOutput';
import {resolveThemeOutput} from '@core/themes/output';
import {SUNDAY_STANDBY_PICTURE_IDS} from '@core/themes/sundayStandby';
import {resolveItemTheme, resolveThemeScreen} from '@core/themes/resolve';
import {itemThemeCell} from '@core/themes/itemThemeCell';
import {createServiceItemId} from '@core/schema/ids';
import {newSlidesItem} from '@core/services/slidesEdits';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {
  IMAGE_SLIDES_THEME_ID,
  legacySermonTitleLayout,
} from '@core/themes/defaults';
import {BIBLE_THEME_ID} from '@core/themes/defaults';

describe('published theme compositions', () => {
  it('resolves a deleted item theme from its frozen layouts', () => {
    const file = themeFile();
    const original = file.themes[0];
    if (original === undefined) throw Error('Missing theme');
    const deleted = {
      ...file,
      themes: file.themes.filter(theme => theme.id !== original.id),
      deletedThemes: [original],
    };
    expect(
      resolveItemTheme({
        file: deleted,
        kind: 'song',
        source: 'service',
        theme: original.id,
      }),
    ).toEqual(original);
    const item = {
      id: 'song',
      kind: 'song' as const,
      source: 'service' as const,
      theme: original.id,
    };
    const before = resolveThemeOutput({
      file,
      screens: themeScreens,
      item,
      revision: 1,
    });
    const after = resolveThemeOutput({
      file: deleted,
      screens: themeScreens,
      item,
      revision: 1,
    });
    expect(after).toEqual(before);
  });
  it('updates the former sermon broadcast layout but retains a custom layout', () => {
    const theme = themeFile().themes.find(
      entry => entry.id === SERMON_TITLE_THEME_ID,
    );
    const screen = themeScreens.find(entry => entry.id === THEME_CAPTURE);
    if (!theme || !screen) throw Error('Missing sermon broadcast');
    const current = theme.screens[screen.id];
    if (!current) throw Error('Missing sermon broadcast layout');
    const old = {
      ...current,
      elements: current.elements.map(element => ({
        ...element,
        frame:
          element.kind === 'box'
            ? {x: 0, y: 790, w: 1920, h: 200}
            : element.kind === 'itemName'
              ? {x: 160, y: 823, w: 1600, h: 56}
              : {x: 160, y: 865, w: 1600, h: 112},
      })),
    };
    const saved = {...theme, screens: {...theme.screens, [screen.id]: old}};
    expect(resolveThemeScreen(saved, screen.id, themeScreens).layout).toEqual(
      current,
    );
    const custom = {...old, background: '#123456'};
    expect(
      resolveThemeScreen(
        {...saved, screens: {...saved.screens, [screen.id]: custom}},
        screen.id,
        themeScreens,
      ).layout,
    ).toEqual(custom);
  });
  it('updates the former Bible stage frames together and keeps custom frames', () => {
    const theme = themeFile().themes.find(entry => entry.id === BIBLE_THEME_ID);
    const stage = themeScreens.find(screen => screen.id === THEME_STAGE);
    if (!theme || !stage) throw Error('Missing Bible stage');
    const current = theme.screens[stage.id];
    if (!current) throw Error('Missing stage layout');
    const old = {
      ...current,
      elements: current.elements.map(element =>
        element.kind === 'currentText'
          ? {
              ...element,
              frame: {...element.frame, x: 154, w: 1612, h: 468},
              text: {...element.text, tracking: 0},
            }
          : element.kind === 'nextText'
            ? {...element, frame: {...element.frame, y: 706, h: 272}}
            : element,
      ),
    };
    const saved = {...theme, screens: {...theme.screens, [stage.id]: old}};
    expect(resolveThemeScreen(saved, stage.id, themeScreens).layout).toEqual(
      current,
    );
    const custom = {
      ...old,
      elements: old.elements.map(element =>
        element.kind === 'nextText'
          ? {...element, frame: {...element.frame, y: 720}}
          : element,
      ),
    };
    expect(
      resolveThemeScreen(
        {...saved, screens: {...saved.screens, [stage.id]: custom}},
        stage.id,
        themeScreens,
      ).layout,
    ).toEqual(custom);
  });
  it('updates an untouched saved Bible stage reference without replacing other edits', () => {
    const file = themeFile();
    const theme = file.themes.find(entry => entry.id === BIBLE_THEME_ID);
    const stage = themeScreens.find(screen => screen.id === THEME_STAGE);
    if (!theme || !stage) throw Error('Missing Bible stage');
    const old = legacySermonTitleLayout(stage);
    const edited = {
      ...theme,
      edited: true,
      screens: {...theme.screens, [stage.id]: {...old, background: '#112233'}},
    };
    const resolved = resolveThemeScreen(edited, stage.id, themeScreens).layout;
    expect(resolved.background).toBe('#112233');
    expect(
      resolved.elements.find(element => element.kind === 'reference'),
    ).toMatchObject({frame: {y: 120, h: 104}, text: {size: 72}});
    const custom = {
      ...edited,
      screens: {
        ...edited.screens,
        [stage.id]: {
          ...old,
          elements: old.elements.map(element =>
            element.kind === 'reference'
              ? {...element, text: {...element.text, size: 60}}
              : element,
          ),
        },
      },
    };
    expect(
      resolveThemeScreen(custom, stage.id, themeScreens).layout.elements.find(
        element => element.kind === 'reference',
      ),
    ).toMatchObject({text: {size: 60}});
  });
  it('left-aligns unchanged saved sermon stage text while preserving custom text', () => {
    const file = themeFile();
    const theme = file.themes.find(entry => entry.id === SERMON_TITLE_THEME_ID);
    const stage = themeScreens.find(screen => screen.id === THEME_STAGE);
    if (!theme || !stage) throw Error('Missing sermon stage');
    const layout = theme.screens[stage.id];
    if (!layout) throw Error('Missing stage layout');
    const previous = {
      ...layout,
      elements: layout.elements.map(element =>
        element.kind === 'itemName' || element.kind === 'currentText'
          ? {...element, text: {...element.text, align: 'center' as const}}
          : element,
      ),
    };
    const saved = {
      ...theme,
      edited: true,
      screens: {...theme.screens, [stage.id]: previous},
    };
    const result = resolveThemeScreen(saved, stage.id, themeScreens).layout;
    expect(
      result.elements.find(element => element.kind === 'itemName'),
    ).toMatchObject({frame: {x: 154}, text: {size: 52, align: 'left'}});
    expect(
      result.elements.find(element => element.kind === 'currentText'),
    ).toMatchObject({frame: {x: 154}, text: {size: 83, align: 'left'}});
    const custom = {
      ...saved,
      screens: {
        ...saved.screens,
        [stage.id]: {
          ...previous,
          elements: previous.elements.map(element =>
            element.kind === 'currentText'
              ? {...element, text: {...element.text, size: 91}}
              : element,
          ),
        },
      },
    };
    const retained = resolveThemeScreen(custom, stage.id, themeScreens).layout;
    expect(
      retained.elements.find(element => element.kind === 'itemName'),
    ).toMatchObject({text: {align: 'left'}});
    expect(
      retained.elements.find(element => element.kind === 'currentText'),
    ).toMatchObject({text: {size: 91, align: 'center'}});
  });
  it('updates untouched legacy sermon screens while preserving edited layouts', () => {
    const file = themeFile();
    const theme = file.themes.find(entry => entry.id === SERMON_TITLE_THEME_ID);
    const broadcast = themeScreens.find(screen => screen.id === THEME_CAPTURE);
    const stage = themeScreens.find(screen => screen.id === THEME_STAGE);
    if (!theme || !broadcast || !stage) throw Error('Missing sermon screens');
    const legacy = {
      ...theme,
      edited: true,
      screens: {
        ...theme.screens,
        [broadcast.id]: legacySermonTitleLayout(broadcast),
        [stage.id]: legacySermonTitleLayout(stage),
      },
    };
    const request = {
      file: {
        ...file,
        themes: file.themes.map(entry =>
          entry.id === theme.id ? legacy : entry,
        ),
      },
      screens: themeScreens,
      item: {
        id: 'sermon',
        kind: 'blank' as const,
        source: 'service' as const,
        theme: theme.id,
        title: '마태복음 11:29~30',
      },
      revision: 1,
    };
    const output = resolveThemeOutput(request);
    expect(output.screens[THEME_MAIN]?.layout).toEqual(
      theme.screens[THEME_MAIN],
    );
    expect(output.screens[THEME_CAPTURE]?.layout).toEqual(
      theme.screens[THEME_CAPTURE],
    );
    expect(output.screens[THEME_STAGE]?.layout).toEqual(
      theme.screens[THEME_STAGE],
    );
    const custom = {
      ...legacy,
      screens: {
        ...legacy.screens,
        [broadcast.id]: {mode: {kind: 'own' as const}, elements: []},
      },
    };
    const customOutput = resolveThemeOutput({
      ...request,
      file: {
        ...file,
        themes: file.themes.map(entry =>
          entry.id === theme.id ? custom : entry,
        ),
      },
    });
    expect(customOutput.screens[THEME_CAPTURE]?.layout.elements).toEqual([]);
  });
  it('uses the edited standby for an explicit item on every screen and in previews', () => {
    const initial = themeFile();
    const main = initial.standby.screens[THEME_MAIN];
    if (!main) throw Error('Missing standby');
    const edited = {
      ...initial,
      standby: {
        ...initial.standby,
        screens: {
          ...initial.standby.screens,
          [THEME_MAIN]: {
            ...main,
            elements: [...main.elements, fixedThemeText('edited')],
          },
        },
      },
    };
    const item = {
      id: 'waiting',
      kind: 'blank' as const,
      source: 'service' as const,
      theme: edited.standby.id,
    };
    const live = resolveThemeOutput({
      file: edited,
      screens: themeScreens,
      item,
      revision: 2,
    });
    const idle = resolveThemeOutput({
      file: edited,
      screens: themeScreens,
      item: null,
      revision: 2,
    });
    expect(live.missing).toEqual([]);
    expect(live.screens).toEqual(idle.screens);
    expect(live.screens[THEME_MAIN]?.layout.elements).toContainEqual(
      fixedThemeText('edited'),
    );
    expect(
      live.screens[THEME_STAGE]?.layout.elements.map(element => element.kind),
    ).toEqual(['clock', 'timer']);
    expect(live.screens[THEME_CAPTURE]?.layout.elements).toEqual([]);
    const preview = resolveItemTheme({
      file: edited,
      kind: 'blank',
      source: 'service',
      theme: edited.standby.id,
      screens: themeScreens,
    });
    expect(
      resolveThemeScreen(preview, THEME_MAIN, themeScreens).layout,
    ).toEqual(live.screens[THEME_MAIN]?.layout);
    const serviceItem = {
      ...newSlidesItem(
        'blank',
        createServiceItemId('00000000-0000-4000-8000-000000000001'),
      ),
      theme: edited.standby.id,
    };
    expect(itemThemeCell(serviceItem, edited)).toEqual({
      name: edited.standby.name,
      followsDefault: false,
    });
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

  it('renders the retired sermon theme exactly like its replacement on every screen', () => {
    const file = themeFile();
    const retired = createThemeId('00000000-0000-4000-8000-000000000107');
    const item = {
      id: 'sermon',
      kind: 'blank',
      source: 'service',
      title: '갈라디아서 5:25~26',
    } as const;
    const request = {file, screens: themeScreens, revision: 1};
    const old = resolveThemeOutput({
      ...request,
      item: {...item, theme: retired},
    });
    const replacement = resolveThemeOutput({
      ...request,
      item: {...item, theme: SERMON_TITLE_THEME_ID},
    });
    expect(old.themeId).toBe(SERMON_TITLE_THEME_ID);
    expect(old.screens).toEqual(replacement.screens);
    expect(old.missing).toEqual([retired]);
    for (const screen of themeScreens) {
      expect(
        old.screens[screen.id]?.layout.elements.some(
          element =>
            element.kind === 'itemName' || element.kind === 'currentText',
        ),
      ).toBe(true);
    }
  });

  it('uses the item kind default when an unknown theme is missing', () => {
    const file = themeFile();
    const missing = createThemeId('00000000-0000-4000-8000-000000000999');
    const item = {
      id: 'song',
      kind: 'song',
      source: 'service',
      theme: missing,
    } as const;
    const output = resolveThemeOutput({
      file,
      screens: themeScreens,
      item,
      revision: 1,
    });
    const expected = resolveThemeOutput({
      file,
      screens: themeScreens,
      item: {id: item.id, kind: item.kind, source: item.source},
      revision: 1,
    });
    expect(output.themeId).toBe(file.defaults.song);
    expect(output.screens).toEqual(expected.screens);
    expect(output.missing).toContain(missing);
  });

  it('keeps imported image slides on their distinct image theme', () => {
    const file = themeFile();
    const output = resolveThemeOutput({
      file,
      screens: themeScreens,
      item: {
        id: 'deck',
        kind: 'blank',
        source: 'service',
        theme: IMAGE_SLIDES_THEME_ID,
      },
      revision: 1,
    });
    expect(output.themeId).toBe(IMAGE_SLIDES_THEME_ID);
    expect(
      output.screens[THEME_MAIN]?.layout.elements.map(element => element.kind),
    ).toEqual(['media']);
    expect(output.missing).toEqual([]);
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
