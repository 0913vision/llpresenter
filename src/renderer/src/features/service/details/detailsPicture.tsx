import type {JSX} from 'react';
import {
  isItemOfKind,
  type SectionCard,
  type ServiceItem,
  type ServiceItemOf,
} from '@core/schema/service';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {ShowTile} from '@core/schema/showService';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {resolveSongSlideBackground} from '@renderer/features/songs/editor/useSongSlideAppearance';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {stageSlideOf} from '@renderer/session/show';
import {SlidesCanvas, useSlidesAppearance} from '../slides/SlidesVisuals';
import type {useItemSlides} from '../items/useItemSlides';
import type {
  PreviewRole,
  previewAppearance,
} from '@renderer/features/songs/editor/songPreviewModel';

interface PictureContext {
  readonly item: ServiceItem | null;
  readonly library: ShowLibrarySong | null;
  readonly song: SongSession | null;
  readonly raw: ReturnType<typeof useItemSlides>;
  readonly projectedTiles: readonly ShowTile[] | undefined;
  readonly role: PreviewRole;
  readonly screenId: string | undefined;
  readonly bibleAppearance: ReturnType<typeof previewAppearance> | undefined;
  readonly card: SectionCard | undefined;
  readonly offset: number;
  readonly theme: ReturnType<typeof useSlideTheme>;
  readonly cardTheme: ReturnType<typeof useSlideTheme>;
  readonly projection: ReturnType<typeof useBibleTileProjection>;
  readonly bibleTiles:
    NonNullable<ReturnType<typeof useBibleTileProjection>>['tiles'] | undefined;
  readonly editor: SongEditorStore;
}

function cardPicture(context: PictureContext): JSX.Element | undefined {
  const {item, card, cardTheme} = context;
  if (item === null || card === undefined || cardTheme === undefined) {
    return undefined;
  }
  return (
    <SlidePicture
      output
      {...cardTheme}
      slide={
        stageSlideOf({itemId: item.id, index: 0}) ?? {
          itemId: item.id,
          position: 0,
          label: card.name,
          lines: [card.english],
          sectionCard: card,
        }
      }
    />
  );
}

function biblePicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, projection, offset, bibleTiles, bibleAppearance} = context;
  if (
    item === null ||
    !isItemOfKind(item, 'bible') ||
    projection?.appearance === undefined
  ) {
    return undefined;
  }
  const slide =
    stageSlideOf({itemId: item.id, index}) ??
    slideLayerOf(
      {itemId: item.id, index: index - offset},
      () => bibleTiles ?? projection.tiles,
    );
  if (slide === null) return undefined;
  const {theme, screen} = bibleAppearance ?? projection.appearance;
  return (
    <SlidePicture
      output
      slide={slide}
      themeId={theme.themeId}
      screen={screen}
      layout={theme.layout}
      emptyColor={theme.emptyColor}
      item={theme.item}
    />
  );
}

function songPicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, raw, offset, theme, song, projectedTiles} = context;
  if (item === null || !isItemOfKind(item, 'song') || theme === undefined) {
    return undefined;
  }
  const slide = raw[index - offset];
  if (slide === undefined) return undefined;
  const projected =
    projectedTiles === undefined
      ? null
      : stageSlideOf({itemId: item.id, index});
  return (
    <SlidePicture
      output
      {...theme}
      background={resolveSongSlideBackground(item.background, song?.background)}
      slide={
        projected ?? {
          itemId: item.id,
          position: index,
          label: slide.label ?? null,
          lines: slide.text.split('\n'),
          ...(slide.titleSlide === undefined
            ? {}
            : {titleSlide: slide.titleSlide}),
          ...(slide.titleLayout === undefined
            ? {}
            : {titleLayout: slide.titleLayout}),
        }
      }
    />
  );
}

function libraryPicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {library, theme} = context;
  const slide = library?.tiles[index];
  if (library === null || slide === undefined || theme === undefined) {
    return undefined;
  }
  return (
    <SlidePicture
      output
      {...theme}
      background={library.background?.mediaId}
      slide={{
        itemId: library.songId,
        position: index,
        label: slide.label,
        lines: slide.lines,
        ...(slide.titleSlide === undefined
          ? {}
          : {titleSlide: slide.titleSlide}),
        ...(slide.titleLayout === undefined
          ? {}
          : {titleLayout: slide.titleLayout}),
      }}
    />
  );
}

function mediaPicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, raw, theme} = context;
  if (item === null || !isItemOfKind(item, 'media') || theme === undefined) {
    return undefined;
  }
  const slide = raw[index];
  if (slide === undefined) return undefined;
  return (
    <SlidePicture
      output
      mediaOnly
      {...theme}
      background={item.media}
      slide={{
        itemId: item.id,
        position: index,
        label: slide.label ?? null,
        lines: slide.text.split('\n'),
      }}
    />
  );
}

function fallbackBiblePicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, raw, offset, theme} = context;
  if (item === null || !isItemOfKind(item, 'bible') || theme === undefined) {
    return undefined;
  }
  const slide = raw[index - offset];
  if (slide === undefined) return undefined;
  return (
    <SlidePicture
      output
      {...theme}
      slide={{
        itemId: item.id,
        position: index,
        label: slide.label ?? null,
        lines: slide.text.split('\n'),
      }}
    />
  );
}

function SlidesPicture({
  item,
  editor,
  index,
  role,
  screenId,
  outputSlide,
}: {
  readonly item: ServiceItemOf<'slides'>;
  readonly editor: SongEditorStore;
  readonly index: number;
  readonly role: PreviewRole;
  readonly screenId: string | undefined;
  readonly outputSlide: ReturnType<typeof stageSlideOf>;
}): JSX.Element {
  const {appearance} = useSlidesAppearance(editor.api, item, {role, screenId});
  return (
    <SlidesCanvas
      item={item}
      index={index}
      appearance={appearance}
      outputSlide={outputSlide}
      thumbnail
    />
  );
}

/** Draw only this picture, with the selected source's own slide data. */
export function detailsPicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, card, offset, editor, role, screenId} = context;
  if (card !== undefined && index === 0) return cardPicture(context);
  if (item !== null && isItemOfKind(item, 'slides')) {
    return (
      <SlidesPicture
        item={item}
        editor={editor}
        index={index - offset}
        role={role}
        screenId={screenId}
        outputSlide={stageSlideOf({itemId: item.id, index})}
      />
    );
  }
  if (item !== null && isItemOfKind(item, 'bible')) {
    return biblePicture(context, index) ?? fallbackBiblePicture(context, index);
  }
  if (item !== null && isItemOfKind(item, 'song')) {
    return songPicture(context, index);
  }
  if (item !== null && isItemOfKind(item, 'media')) {
    return mediaPicture(context, index);
  }
  return libraryPicture(context, index);
}
