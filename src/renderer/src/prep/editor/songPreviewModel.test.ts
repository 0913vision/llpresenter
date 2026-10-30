import {describe, expect, it} from 'vitest';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {editorGroupedSong, editorSong} from './editorFixture';
import {editorPreviewFixture} from './editorPreviewFixture';
import {previewAppearance, selectedPreview} from './songPreviewModel';

describe('local song preview model', () => {
  it('uses the current screen Look, explicit layer visibility, and capture preview background', () => {
    const {looks, screens} = editorPreviewFixture();
    const main = previewAppearance('main', looks.value, screens.value);
    expect(main.styleName).toBe('기본 가사');
    expect(main.screen.id).toBe(STARTER_SCREEN_IDS.main);
    expect(main.media).toBe(true);
    const stage = previewAppearance('stage', looks.value, screens.value);
    expect(stage.screen.kind).toBe('stage');
    expect(stage.media).toBe(false);
    expect(
      previewAppearance('broadcast', looks.value, screens.value).background,
    ).toBe('var(--chroma)');
    const uncheckedBinding = previewAppearance(
      'main',
      {
        ...looks.value,
        looks: looks.value.looks.map(look => ({...look, screens: {}})),
      },
      screens.value,
    );
    expect(uncheckedBinding.slide).toBe(false);
    expect(uncheckedBinding.media).toBe(false);
  });

  it('lets a solid Look background replace media and checker, with safe missing-setting fallbacks', () => {
    const {looks, screens} = editorPreviewFixture();
    const appearance = previewAppearance(
      'broadcast',
      {
        ...looks.value,
        looks: looks.value.looks.map(look => ({
          ...look,
          screens: {
            [STARTER_SCREEN_IDS.broadcast]: {
              layers: {slide: true, media: true},
              background: {kind: 'color', color: '#123456'},
            },
          },
        })),
      },
      {
        ...screens.value,
        screens: screens.value.screens.map(screen => ({
          ...screen,
          previewBackground: 'checker',
        })),
      },
    );
    expect(appearance).toMatchObject({
      background: '#123456',
      media: false,
      checker: false,
    });
    expect(previewAppearance('main', undefined, undefined)).toMatchObject({
      slide: true,
      media: true,
      styleName: '기본',
    });
    expect(
      previewAppearance('broadcast', looks.value, {
        ...screens.value,
        screens: screens.value.screens.map(screen => ({
          ...screen,
          previewBackground: 'checker',
        })),
      }).checker,
    ).toBe(true);
  });

  it('draws only the selected local slide and eligible background, never other live layers', () => {
    const song = editorSong(1).song;
    const layers = selectedPreview(
      song,
      {block: 1, background: 'fixture-media'},
      previewAppearance('main', undefined, undefined),
    );
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
      selectedPreview(
        song,
        {block: 99, background: undefined},
        previewAppearance('main', undefined, undefined),
      ).slide,
    ).toBeNull();
  });

  it('draws grouped song slides with group label name across all slides of a group', () => {
    const song = editorGroupedSong(1).song;
    const slide0 = selectedPreview(
      song,
      {block: 0, background: undefined},
      previewAppearance('main', undefined, undefined),
    );
    expect(slide0.slide).toMatchObject({
      itemId: song.id,
      position: 0,
      label: '1절',
      lines: ['새 아침을 노래해요', '함께 걸어요'],
    });

    const slide1 = selectedPreview(
      song,
      {block: 1, background: undefined},
      previewAppearance('main', undefined, undefined),
    );
    expect(slide1.slide).toMatchObject({
      itemId: song.id,
      position: 1,
      label: '1절',
      lines: ['맑은 하늘 바라보며'],
    });

    const slide2 = selectedPreview(
      song,
      {block: 2, background: undefined},
      previewAppearance('main', undefined, undefined),
    );
    expect(slide2.slide).toMatchObject({
      itemId: song.id,
      position: 2,
      label: '후렴',
      lines: ['빛을 따라가요'],
    });
  });
});
