import type {JSX} from 'react';
import {
  isItemOfKind,
  type SectionCard,
  type ServiceItem,
  type ServiceItemOf,
} from '@core/schema/service';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {resolveSongSlideBackground} from '@renderer/features/songs/editor/useSongSlideAppearance';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {SlidesCanvas, useSlidesAppearance} from '../slides/SlidesVisuals';
import type {useItemSlides} from '../items/useItemSlides';

interface PictureContext {
  readonly item: ServiceItem | null;
  readonly library: ShowLibrarySong | null;
  readonly song: SongSession | null;
  readonly raw: ReturnType<typeof useItemSlides>;
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
      {...cardTheme}
      slide={{
        itemId: item.id,
        position: 0,
        label: card.name,
        lines: [card.english],
        sectionCard: card,
      }}
    />
  );
}

function biblePicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, projection, offset, bibleTiles} = context;
  if (
    item === null ||
    !isItemOfKind(item, 'bible') ||
    projection?.appearance === undefined
  ) {
    return undefined;
  }
  const slide = slideLayerOf(
    {itemId: item.id, index: index - offset},
    () => bibleTiles ?? projection.tiles,
  );
  if (slide === null) return undefined;
  const {theme} = projection.appearance;
  return (
    <SlidePicture
      slide={slide}
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
  const {item, raw, offset, theme, song} = context;
  if (item === null || !isItemOfKind(item, 'song') || theme === undefined) {
    return undefined;
  }
  const slide = raw[index - offset];
  if (slide === undefined) return undefined;
  return (
    <SlidePicture
      {...theme}
      background={resolveSongSlideBackground(item.background, song?.background)}
      slide={{
        itemId: item.id,
        position: index,
        label: slide.label ?? null,
        lines: slide.text.split('\n'),
      }}
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
      {...theme}
      background={resolveSongSlideBackground(
        undefined,
        library.background?.mediaId,
      )}
      slide={{
        itemId: library.songId,
        position: index,
        label: slide.label,
        lines: slide.lines,
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
}: {
  readonly item: ServiceItemOf<'slides'>;
  readonly editor: SongEditorStore;
  readonly index: number;
}): JSX.Element {
  const {appearance} = useSlidesAppearance(editor.api, item);
  return (
    <SlidesCanvas item={item} index={index} appearance={appearance} thumbnail />
  );
}

/** Draw only this picture, with the selected source's own slide data. */
export function detailsPicture(
  context: PictureContext,
  index: number,
): JSX.Element | undefined {
  const {item, card, offset, editor} = context;
  if (card !== undefined && index === 0) return cardPicture(context);
  if (item !== null && isItemOfKind(item, 'slides')) {
    return <SlidesPicture item={item} editor={editor} index={index - offset} />;
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
