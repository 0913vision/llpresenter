import type {JSX} from 'react';
import {liturgyAsSlides} from '@core/services/liturgy';
import {
  isItemOfKind,
  type SectionCard,
  type ServiceItem,
} from '@core/schema/service';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {ShowTile} from '@core/schema/showService';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {songItemBackground} from '@core/songs/songBackground';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {mediaTextSlideOf, slideLayerOf} from '@core/presentation/slideLayer';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {
  biblePictureInput,
  cardPictureLayer,
  songPictureLayer,
} from '@renderer/rendering/pictureSpec';
import {stageSlideOf} from '@renderer/session/show';
import {SlidesCanvas} from '../slides/SlidesVisuals';
import type {useItemSlides} from '../items/useItemSlides';
import type {
  PreviewRole,
  previewAppearance,
} from '@renderer/features/songs/editor/songPreviewModel';

interface PictureContext {
  readonly eager?: boolean;
  readonly item: ServiceItem | null;
  readonly library: ShowLibrarySong | null;
  readonly song: SongSession | null;
  readonly raw: ReturnType<typeof useItemSlides>;
  readonly projectedTiles: readonly ShowTile[] | undefined;
  readonly role: PreviewRole;
  readonly screenId: string | undefined;
  readonly bibleAppearance: ReturnType<typeof previewAppearance> | undefined;
  readonly slidesAppearance: ReturnType<typeof previewAppearance> | undefined;
  readonly card: SectionCard | undefined;
  readonly offset: number;
  readonly theme: ReturnType<typeof useSlideTheme>;
  readonly cardTheme: ReturnType<typeof useSlideTheme>;
  readonly sermonTheme: ReturnType<typeof useSlideTheme>;
  readonly projection: Pick<
    NonNullable<ReturnType<typeof useBibleTileProjection>>,
    'tiles' | 'appearance'
  > | null;
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
      {...cardTheme}
      slide={
        stageSlideOf({itemId: item.id, index: 0}) ??
        cardPictureLayer(item.id, card, item.textOverrides?.['section'])
      }
    />
  );
}

function biblePicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, projection, offset, bibleTiles, bibleAppearance, sermonTheme} =
    context;
  if (
    item === null ||
    (!isItemOfKind(item, 'bible') && !isItemOfKind(item, 'sermon')) ||
    projection?.appearance === undefined
  ) {
    return undefined;
  }
  const slide = slideLayerOf(
    {itemId: item.id, index: index - offset},
    () => bibleTiles ?? projection.tiles,
  );
  if (slide === null) return undefined;
  if (slide.sermonTitle === true && sermonTheme !== undefined) {
    return <SlidePicture {...sermonTheme} slide={slide} />;
  }
  return (
    <SlidePicture
      {...biblePictureInput(slide, bibleAppearance ?? projection.appearance, {
        background: projection.appearance.background,
        sourceScreenId: (bibleAppearance ?? projection.appearance).theme
          .sourceScreenId,
        audience: bibleAppearance?.audience,
        stageLyricLabelPosition: bibleAppearance?.stageLyricLabelPosition,
      })}
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
      {...theme}
      background={songItemBackground({
        backgroundNone: item.backgroundNone,
        item: item.background,
        song: song?.background,
      })}
      songSource={projectedTiles?.[index]?.sourceSlide}
      slide={
        projected ??
        songPictureLayer(item.id, index, {
          lines: slide.text.split('\n'),
          ...(slide.label == null ? {} : {label: slide.label}),
          ...(slide.titleSlide === undefined
            ? {}
            : {titleSlide: slide.titleSlide}),
          ...(slide.titleLineCount === undefined
            ? {}
            : {titleLineCount: slide.titleLineCount}),
          ...(slide.lyricFormat === undefined
            ? {}
            : {lyricFormat: slide.lyricFormat}),
          ...(slide.titleLayout === undefined
            ? {}
            : {titleLayout: slide.titleLayout}),
        })
      }
    />
  );
}

function libraryPicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {library, theme} = context;
  if (library === null || theme === undefined) return undefined;
  const tile = library.tiles[index];
  const slide = slideLayerOf(
    {itemId: library.songId, index},
    () => library.tiles,
  );
  if (tile === undefined || slide === null) return undefined;
  return (
    <SlidePicture
      {...theme}
      background={library.background?.mediaId}
      songSource={tile.sourceSlide}
      slide={slide}
    />
  );
}

function mediaPicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, raw, theme, projectedTiles} = context;
  if (item === null || !isItemOfKind(item, 'media') || theme === undefined) {
    return undefined;
  }
  const projected = slideLayerOf(
    {itemId: item.id, index},
    () => projectedTiles ?? [],
  );
  if (projected === null && raw[index] === undefined) return undefined;
  const slide = mediaTextSlideOf(
    {itemId: item.id, index},
    () => projectedTiles ?? [],
  );
  return (
    <SlidePicture
      {...theme}
      mediaOnly={slide.textOverrides === undefined}
      background={item.media}
      slide={slide}
    />
  );
}

function fallbackBiblePicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, raw, offset, theme} = context;
  if (
    item === null ||
    (!isItemOfKind(item, 'bible') && !isItemOfKind(item, 'sermon')) ||
    theme === undefined
  ) {
    return undefined;
  }
  const slide = raw[index - offset];
  if (slide === undefined) return undefined;
  return (
    <SlidePicture
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

/** Draw only this picture, with the selected source's own slide data. */
export function detailsPicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, card, offset, slidesAppearance, eager} = context;
  if (card !== undefined && index === 0) return cardPicture(context);
  if (item !== null && isItemOfKind(item, 'liturgy')) {
    return slidesAppearance === undefined ? undefined : (
      <SlidesCanvas
        eager={eager === true}
        item={liturgyAsSlides(item)}
        index={index - offset}
        appearance={slidesAppearance}
        outputSlide={stageSlideOf({itemId: item.id, index})}
      />
    );
  }
  if (item !== null && isItemOfKind(item, 'slides')) {
    return slidesAppearance === undefined ? undefined : (
      <SlidesCanvas
        eager={eager === true}
        item={item}
        index={index - offset}
        appearance={slidesAppearance}
        outputSlide={stageSlideOf({itemId: item.id, index})}
      />
    );
  }
  if (
    item !== null &&
    (isItemOfKind(item, 'bible') || isItemOfKind(item, 'sermon'))
  ) {
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
