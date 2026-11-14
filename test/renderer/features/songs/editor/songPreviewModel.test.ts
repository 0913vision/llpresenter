import {describe, expect, it} from 'vitest';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {createScreenId} from '@core/schema/ids';
import {resolveThemeOutput} from '@core/themes/output';
import {
  editorDeckSong,
  editorSong,
} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {editorPreviewFixture} from '@fixtures/renderer/features/songs/editor/editorPreviewFixture';
import {
  previewAppearance,
  selectedPreview,
} from '@renderer/features/songs/editor/songPreviewModel';

describe('local song preview model', () => {
  it.each(['song', 'bible', 'blank', 'ad', 'media'] as const)(
    'uses the live composition for %s on all screen roles',
    kind => {
      const {themes, screens} = editorPreviewFixture();
      const theme = themes.value.themes[0];
      if (theme === undefined) throw new Error('Missing theme');
      const item = {
        id: 'prepared',
        kind,
        source: 'service' as const,
        theme: theme.id,
      };
      const live = resolveThemeOutput({
        file: themes.value,
        screens: screens.value.screens,
        item,
        revision: 0,
      });
      for (const role of ['audience', 'stage', 'broadcast'] as const) {
        const preview = previewAppearance({
          role,
          themes: themes.value,
          screens: screens.value,
          item,
        });
        const composition = live.screens[preview.screen.id];
        if (composition === undefined) throw new Error('Missing composition');
        expect(preview.theme).toMatchObject(composition);
        expect(preview.theme.themeId).toBe(live.themeId);
      }
    },
  );
  it('uses the configured screen when its starter screen has been replaced', () => {
    const {themes, screens} = editorPreviewFixture();
    const id = createScreenId('00000000-0000-4000-8000-000000000099');
    const replaced = {
      ...screens.value,
      screens: screens.value.screens.map(screen =>
        screen.kind === 'broadcast'
          ? {...screen, id, method: 'ndi' as const}
          : screen,
      ),
    };
    expect(
      previewAppearance({
        role: 'broadcast',
        themes: themes.value,
        screens: replaced,
      }).screen,
    ).toMatchObject({id, method: 'ndi'});
  });
  it('resolves a second screen of the same kind independently', () => {
    const {themes, screens} = editorPreviewFixture();
    const original = screens.value.screens.find(
      screen => screen.kind === 'audience',
    );
    if (!original) throw new Error('Missing audience screen');
    const extra = {
      ...original,
      id: createScreenId('00000000-0000-4000-8000-000000000098'),
    };
    const value = {
      ...screens.value,
      screens: [...screens.value.screens, extra],
    };
    expect(
      previewAppearance({
        role: 'audience',
        screenId: extra.id,
        themes: themes.value,
        screens: value,
      }).screen.id,
    ).toBe(extra.id);
  });
  it('keeps the configured caption and picture correction for output', () => {
    const {themes, screens} = editorPreviewFixture();
    const configured = {
      ...screens.value,
      screens: screens.value.screens.map(screen =>
        screen.kind === 'broadcast'
          ? {
              ...screen,
              songCaption: 'text' as const,
              edgeMargin: 5,
              offset: {x: 12, y: -3},
            }
          : screen,
      ),
    };
    const preview = previewAppearance({
      role: 'broadcast',
      themes: themes.value,
      screens: configured,
    });
    expect(preview.screen).toMatchObject({
      songCaption: 'text',
      correction: {edgeMargin: 5, offset: {x: 12, y: -3}},
    });
  });
  it('retains the selected title identity and its song background', () => {
    const song = editorDeckSong(1).song;
    const first = song.slides[0];
    if (first === undefined) throw new Error('Missing slide');
    const selected = selectedPreview(
      {
        ...song,
        slides: [
          {
            ...first,
            titleSlide: true,
            titleLayout: {titleTracking: 12, subtitleTracking: 12},
            lines: ['Title', 'Subtitle'],
          },
        ],
      },
      {
        block: 0,
        background: 'photo',
      },
    );
    expect(selected.slide).toMatchObject({
      titleSlide: true,
      titleLayout: {titleTracking: 12, subtitleTracking: 12},
      lines: ['Title', 'Subtitle'],
    });
    expect(selected.slide?.transition).toBeUndefined();
    expect(selected.media?.mediaId).toBe('photo');
  });
  it('projects the chosen next source block and omits it after the last place', () => {
    const song = editorDeckSong(1).song;
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
    expect(final.slide?.lines).toEqual(song.slides[0]?.lines);
  });
  it('maps each preview role to its screen, theme name, and configured empty color', () => {
    const {themes, screens} = editorPreviewFixture();
    const main = previewAppearance({
      role: 'audience',
      themes: themes.value,
      screens: screens.value,
    });
    expect(main.themeName).toBe(themes.value.themes[0]?.name);
    expect(main.screen.id).toBe(STARTER_SCREEN_IDS.main);
    const stage = previewAppearance({
      role: 'stage',
      themes: themes.value,
      screens: screens.value,
    });
    expect(stage.screen.kind).toBe('stage');
    expect(
      previewAppearance({
        role: 'broadcast',
        themes: themes.value,
        screens: screens.value,
      }).background,
    ).toBe('#00B140');
  });

  it('passes a service item theme override through to the theme output', () => {
    const {themes, screens} = editorPreviewFixture();
    const theme = themes.value.themes[1];
    if (theme === undefined) throw new Error('Missing theme');
    const item = {
      id: 'service-item',
      kind: 'bible',
      source: 'service',
      theme: theme.id,
    } as const;
    const appearance = previewAppearance({
      role: 'audience',
      themes: themes.value,
      screens: screens.value,
      item: item,
    });
    expect(appearance.theme.themeId).toBe(theme.id);
    expect(appearance.theme.item).toBe(item);
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
      lines: song.slides[1]?.lines,
    });
    expect(layers.media).toEqual({
      mediaId: 'fixture-media',
      startedAt: 0,
      loop: true,
    });
    expect(layers).toMatchObject({prop: null, message: null});
    expect(
      selectedPreview(song, {block: 99, background: undefined}).slide,
    ).toBeNull();
  });

  it('draws grouped song slides with group label name across all slides of a group', () => {
    const song = editorDeckSong(1).song;
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
