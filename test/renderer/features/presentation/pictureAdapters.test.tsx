import {stageSlideOf, useShow} from '@renderer/session/show';
import {isValidElement} from 'react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {createMediaId, createSongId} from '@core/schema/ids';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {SlideTile} from '@core/presentation/model';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {detailsPicture} from '@renderer/features/service/details/detailsPicture';
import {prefetchPictureSpecs} from '@renderer/features/presentation/SlidePicturePrefetch';
import {
  tilePictureSpec,
  serviceTileThemes,
} from '@renderer/features/presentation/tilePicture';
import {pictureSpec} from '@renderer/rendering/pictureSpec';
import type {SlideInput} from '@renderer/rendering/outputSlideSpec';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import {slideTheme} from '@renderer/platform/useSlideTheme';
import {themeFile, themeScreens} from '@fixtures/core/themeOutput';
import {ids, templateOrder} from '@fixtures/core/serviceList';
import {isItemOfKind} from '@core/schema/service';

type Context = Parameters<typeof detailsPicture>[0];
function context(overrides: Partial<Context>): Context {
  const editor = new SongEditorStore(mockLlpApi(), vi.fn());
  onTestFinished(() => editor.dispose());
  return {
    item: null,
    library: null,
    song: null,
    raw: [],
    projectedTiles: undefined,
    role: 'audience',
    screenId: undefined,
    bibleAppearance: undefined,
    card: undefined,
    offset: 0,
    theme: undefined,
    cardTheme: undefined,
    sermonTheme: undefined,
    projection: null,
    bibleTiles: undefined,
    editor,
    ...overrides,
  };
}
function detailsSpec(data: Context, index: number) {
  const element = detailsPicture(data, index);
  if (!isValidElement<SlideInput>(element)) {
    throw new Error('Missing details picture');
  }
  return pictureSpec({kind: 'slide', input: element.props}).spec;
}

it('keeps imported song formatting through the library details and visible tile adapters', () => {
  const id = createSongId('00000000-0000-4000-8000-000000000101');
  const format = {
    lines: [{boxWidth: 640, runs: [{text: 'Title', weight: 700}]}],
  };
  const tile: SlideTile = {
    label: 'Verse',
    labelColor: 'none',
    lines: ['Title'],
    titleSlide: true,
    titleLineCount: 1,
    lyricFormat: format,
  };
  const background = createMediaId('00000000-0000-4000-8000-000000000106');
  const library: ShowLibrarySong = {
    songId: id,
    songRevision: 1,
    title: 'Title',
    readOnly: false,
    tiles: [tile],
    background: {mediaId: background, loop: true},
  };
  const row = {
    id,
    kind: 'song' as const,
    title: library.title,
    background: {mediaId: background, loop: true},
  };
  const theme = slideTheme(row, {
    source: 'external',
    file: themeFile(),
    screens: themeScreens,
  });
  if (theme === undefined) throw new Error('Missing theme');
  const details = detailsSpec(context({library, theme}), 0);
  const themes = serviceTileThemes(row, library.tiles, {
    themes: themeFile(),
    screens: themeScreens,
    bibleAppearance: undefined,
  });
  const shown = tilePictureSpec(
    tile,
    slideLayerOf({itemId: id, index: 0}, () => library.tiles),
    themes,
  );
  if (shown === undefined) throw new Error('Missing visible tile');
  expect(details.layers.slide).toMatchObject({
    titleLineCount: 1,
    lyricFormat: format,
  });
  expect(details.layers.slide).toEqual(shown.layers.slide);
  expect(details.layers.media).toEqual(shown.layers.media);
  expect(details.layers.media?.mediaId).toBe(background);
  expect(details.appearance.theme.layout).toEqual(
    shown.appearance.theme.layout,
  );
});

it('shares a split Bible part and its resolved appearance between details and preload', () => {
  const item = templateOrder.find(value => isItemOfKind(value, 'bible'));
  if (item === undefined || !isItemOfKind(item, 'bible')) {
    throw new Error('Missing Bible item');
  }
  const mediaId = createMediaId('00000000-0000-4000-8000-000000000105');
  const appearance = {
    ...previewAppearance({
      role: 'audience',
      themes: themeFile(),
      screens: {
        format: 'llsettings.screens',
        schemaVersion: 1,
        screens: themeScreens,
      },
      item: {id: item.id, kind: 'bible', source: 'service', title: 'Passage'},
    }),
    background: mediaId,
  };
  const tiles: readonly SlideTile[] = [
    {label: '1:1', labelColor: 'none', lines: ['First part'], biblePart: 1},
    {
      label: '1:1',
      labelColor: 'none',
      lines: ['Second part'],
      biblePart: 2,
      continued: true,
    },
  ];
  const projection = {tiles, appearance};
  const details = detailsSpec(
    context({item, projection, bibleTiles: tiles}),
    1,
  );
  const row = {
    id: item.id,
    kind: 'bible' as const,
    title: 'Passage',
    bible: item.bible,
  };
  const specs = prefetchPictureSpecs(row, tiles, {
    themes: themeFile(),
    screens: themeScreens,
    bibleAppearance: appearance,
  });
  const preloaded = specs[1];
  if (preloaded === undefined) throw new Error('Missing preloaded part');
  expect(details.layers.slide).toEqual(preloaded.layers.slide);
  expect(details.layers.slide).toMatchObject({
    position: 1,
    biblePart: 2,
    continued: true,
    lines: ['Second part'],
  });
  expect(details.layers.media?.mediaId).toBe(mediaId);
  expect(details.layers.media).toEqual(preloaded.layers.media);
  expect(details.appearance.screen).toEqual(preloaded.appearance.screen);
  expect(details.appearance.theme).toEqual(preloaded.appearance.theme);
});

it('uses the same sermon boundary cues in preparation and show previews', () => {
  const item = templateOrder.find(value => isItemOfKind(value, 'bible'));
  if (item === undefined || !isItemOfKind(item, 'bible')) {
    throw new Error('Missing Bible item');
  }
  const screens = {
    format: 'llsettings.screens' as const,
    schemaVersion: 1 as const,
    screens: themeScreens,
  };
  const appearance = previewAppearance({
    role: 'stage',
    themes: themeFile(),
    screens,
    item: {id: item.id, kind: 'bible', source: 'service', title: 'Passage'},
  });
  const title = {
    label: null,
    labelColor: 'none' as const,
    lines: ['Sermon'],
    sermonTitle: true as const,
  };
  const tiles: readonly SlideTile[] = [
    title,
    {label: '1:1', labelColor: 'none', lines: ['First verse']},
    {label: '1:2', labelColor: 'none', lines: ['Final verse']},
    title,
  ];
  const sermonTheme = slideTheme(
    {id: item.id, kind: 'slides', form: 'blank', title: 'Passage'},
    {
      source: 'service',
      file: themeFile(),
      screens: themeScreens,
      role: 'stage',
    },
  );
  if (sermonTheme === undefined) throw new Error('Missing sermon theme');
  const data = context({
    item,
    projection: {tiles, appearance},
    bibleTiles: tiles,
    sermonTheme,
    role: 'stage',
  });
  const previous = useShow.getState();
  onTestFinished(() => useShow.setState(previous, true));
  useShow.setState({
    rows: [
      {kind: 'bible', id: item.id, title: 'Passage', sermonTitle: 'Sermon'},
    ],
    tiles: {[item.id]: tiles},
  });
  for (const index of [0, 1, 2, 3]) {
    expect(detailsSpec(data, index).layers.slide?.next).toEqual(
      stageSlideOf({itemId: item.id, index})?.next,
    );
  }
  expect(detailsSpec(data, 0).layers.slide?.next).toBeUndefined();
  expect(detailsSpec(data, 1).layers.slide?.next?.lines).toEqual([
    'Final verse',
  ]);
  expect(detailsSpec(data, 2).layers.slide?.next).toBeUndefined();
});

it('preserves formatted song data in the item fallback while projection is loading', () => {
  const format = {
    lines: [{boxWidth: 640, runs: [{text: 'Title', weight: 700}]}],
  };
  const item = {id: ids.doxology, song: ids.firstSong, slides: []};
  const theme = slideTheme(
    {id: item.id, kind: 'song', title: 'Title'},
    {source: 'service', file: themeFile(), screens: themeScreens},
  );
  if (theme === undefined) throw new Error('Missing theme');
  const spec = detailsSpec(
    context({
      item,
      theme,
      raw: [
        {
          text: 'Title',
          label: undefined,
          color: 'none',
          media: undefined,
          titleSlide: true,
          titleLineCount: 1,
          lyricFormat: format,
        },
      ],
    }),
    0,
  );
  expect(spec.layers.slide).toMatchObject({
    titleLineCount: 1,
    lyricFormat: format,
  });
});
