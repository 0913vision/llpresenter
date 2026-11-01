import {describe, expect, it} from 'vitest';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {
  editorGroupedSong,
  editorSong,
} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {editorPreviewFixture} from '@fixtures/renderer/features/songs/editor/editorPreviewFixture';
import {
  previewAppearance,
  selectedPreview,
} from '@renderer/features/songs/editor/songPreviewModel';

describe('local song preview model', () => {
  it('projects the chosen next source block and omits it after the last place', () => {
    const song = editorGroupedSong(1).song;
    const intermediate = selectedPreview(song, {
      block: 1,
      nextBlock: 2,
      background: undefined,
    });
    expect(intermediate.slide?.next).toEqual({
      label: '후렴',
      lines: ['빛을 따라가요'],
    });
    const final = selectedPreview(song, {
      block: 0,
      nextBlock: undefined,
      background: undefined,
    });
    expect(final.slide).not.toHaveProperty('next');
    expect(final.slide?.lines).toEqual(song.groups[0]?.slides[0]?.lines);
  });
  it('uses the same per-screen theme composition and configured empty color as output', () => {
    const {themes, screens} = editorPreviewFixture();
    const main = previewAppearance({
      role: 'main',
      themes: themes.value,
      screens: screens.value,
    });
    expect(main.themeName).toBe(themes.value.themes[0]?.name);
    expect(main.screen.id).toBe(STARTER_SCREEN_IDS.main);
    expect(
      main.theme.layout.elements.some(element => element.kind === 'background'),
    ).toBe(true);
    const stage = previewAppearance({
      role: 'stage',
      themes: themes.value,
      screens: screens.value,
    });
    expect(stage.screen.kind).toBe('stage');
    expect(
      stage.theme.layout.elements.some(
        element => element.kind === 'background',
      ),
    ).toBe(false);
    expect(
      stage.theme.layout.elements.some(element => element.kind === 'nextText'),
    ).toBe(true);
    expect(
      previewAppearance({
        role: 'broadcast',
        themes: themes.value,
        screens: screens.value,
      }).background,
    ).toBe('#00B140');
  });

  it('uses built-in themes before settings load and follows a service item override', () => {
    const {themes, screens} = editorPreviewFixture();
    expect(
      previewAppearance({role: 'main', themes: undefined, screens: undefined}),
    ).toMatchObject({
      theme: {layout: {mode: {kind: 'own'}}},
    });
    const theme = themes.value.themes[1];
    if (theme === undefined) throw new Error('Missing theme');
    const item = {
      id: 'service-item',
      kind: 'bible',
      source: 'service',
      theme: theme.id,
    } as const;
    const appearance = previewAppearance({
      role: 'main',
      themes: themes.value,
      screens: screens.value,
      item: item,
    });
    expect(appearance.theme.themeId).toBe(theme.id);
    expect(appearance.theme.item).toBe(item);
    expect(
      appearance.theme.layout.elements.some(
        element => element.kind === 'reference',
      ),
    ).toBe(true);
  });

  it('draws only the selected local slide and eligible background, never other live layers', () => {
    const song = editorSong(1).song;
    const layers = selectedPreview(song, {
      block: 1,
      background: 'fixture-media',
    });
    expect(layers.slide).toMatchObject({
      itemId: song.id,
      position: 1,
      lines: song.groups[1]?.slides[0]?.lines,
    });
    expect(layers.media).toEqual({
      mediaId: 'fixture-media',
      startedAt: 0,
      loop: true,
    });
    expect(layers).toMatchObject({notice: null, prop: null, message: null});
    expect(
      selectedPreview(song, {block: 99, background: undefined}).slide,
    ).toBeNull();
  });

  it('draws grouped song slides with group label name across all slides of a group', () => {
    const song = editorGroupedSong(1).song;
    const slide0 = selectedPreview(song, {block: 0, background: undefined});
    expect(slide0.slide).toMatchObject({
      itemId: song.id,
      position: 0,
      label: '1절',
      lines: ['새 아침을 노래해요', '함께 걸어요'],
    });

    const slide1 = selectedPreview(song, {block: 1, background: undefined});
    expect(slide1.slide).toMatchObject({
      itemId: song.id,
      position: 1,
      label: '1절',
      lines: ['맑은 하늘 바라보며'],
    });

    const slide2 = selectedPreview(song, {block: 2, background: undefined});
    expect(slide2.slide).toMatchObject({
      itemId: song.id,
      position: 2,
      label: '후렴',
      lines: ['빛을 따라가요'],
    });
  });
});
