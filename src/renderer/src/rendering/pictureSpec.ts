import {emptyLayers, type LiveLayers, type SlideLayer} from '@core/live/state';
import type {SlidesItem} from '@core/services/slidesEdits';
import type {SongSlide} from '@core/schema/song';
import type {SectionCard} from '@core/schema/service';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {projectSlides} from '@core/presentation/slides';
import {withSectionCard} from '@core/services/sectionCards';
import type {SlideTile} from '@core/presentation/model';
import type {PictureSpec} from './pictures/pictureService';
import {outputSlideSpec, type SlideInput} from './outputSlideSpec';

/** Constructs the same song payload for editor tiles, details and the inspector. */
export function songPictureLayer(
  itemId: string,
  position: number,
  slide: Pick<
    SongSlide,
    | 'lines'
    | 'label'
    | 'titleSlide'
    | 'titleLineCount'
    | 'titleLayout'
    | 'lyricFormat'
  >,
): SlideLayer {
  return {
    itemId,
    position,
    lines: slide.lines,
    label: slide.label ?? null,
    ...(slide.titleSlide === undefined ? {} : {titleSlide: slide.titleSlide}),
    ...(slide.titleLineCount === undefined
      ? {}
      : {titleLineCount: slide.titleLineCount}),
    ...(slide.titleLayout === undefined
      ? {}
      : {titleLayout: slide.titleLayout}),
    ...(slide.lyricFormat === undefined
      ? {}
      : {lyricFormat: slide.lyricFormat}),
  };
}

/** A leading card has its own identity and theme, independent of the item slide. */
export function cardPictureLayer(
  itemId: string,
  card: SectionCard,
): SlideLayer {
  return {
    itemId,
    position: 0,
    label: card.name,
    lines: [card.english],
    sectionCard: card,
  };
}

/** Maps a resolved Bible screen into the shared compositor input. */
export function biblePictureInput(
  slide: SlideLayer,
  appearance: Pick<PictureSpec['appearance'], 'screen' | 'theme'>,
  options: {
    readonly background?: string | undefined;
    readonly sourceScreenId?: SlideInput['sourceScreenId'];
    readonly audience?: SlideInput['audience'];
    readonly stageLyricLabelPosition?: SlideInput['stageLyricLabelPosition'];
  } = {},
): SlideInput {
  return {
    slide,
    screen: appearance.screen,
    themeId: appearance.theme.themeId,
    layout: appearance.theme.layout,
    emptyColor: appearance.theme.emptyColor,
    item: appearance.theme.item,
    ...options,
  };
}

/** A resolved slide or a draft whose live layers are already projected. */
export type PreparedPicture =
  | {readonly kind: 'slide'; readonly input: SlideInput}
  | {
      readonly kind: 'layers';
      readonly layers: LiveLayers;
      readonly appearance: PictureSpec['appearance'];
    };

export function slideLayers(
  item: SlidesItem,
  index: number,
  {
    projection,
    part = 0,
  }: {
    readonly projection?:
      {readonly tiles: readonly SlideTile[]} | null | undefined;
    readonly part?: number | undefined;
  } = {},
): LiveLayers {
  if (projection != null) {
    const id = item.slides.slides[index]?.id;
    const indices = projection.tiles.flatMap((tile, at) =>
      tile.sourceSlideId === id ? [at] : [],
    );
    const at = indices[Math.min(part, indices.length - 1)];
    if (at === undefined) return emptyLayers();
    const tile = projection.tiles[at];
    const background = tile?.picture ?? item.background;
    return {
      ...emptyLayers(),
      slide: slideLayerOf({itemId: item.id, index: at}, () => projection.tiles),
      media:
        background === undefined
          ? null
          : {
              mediaId: background,
              loop: tile?.picture === undefined,
              startedAt: 0,
              ...(tile?.picture === undefined
                ? {}
                : {itemId: item.id, slidePicture: true}),
            },
    };
  }
  const tiles = withSectionCard(item.sectionCard, projectSlides(item));
  const position = index + (item.sectionCard === undefined ? 0 : 1);
  const slide = slideLayerOf({itemId: item.id, index: position}, () => tiles);
  if (slide === null) return emptyLayers();
  const background = slide.picture ?? item.background;
  return {
    ...emptyLayers(),
    slide,
    media:
      background === undefined
        ? null
        : {
            mediaId: background,
            loop: slide.picture === undefined,
            startedAt: 0,
            ...(slide.picture === undefined
              ? {}
              : {itemId: item.id, slidePicture: true}),
          },
  };
}

/** Pure compositor inputs shared by prepared tiles, details and inspectors. */
export interface TileThemes {
  readonly theme: Omit<SlideInput, 'slide'> | undefined;
  readonly cardTheme: Omit<SlideInput, 'slide'> | undefined;
  readonly sermonTheme: Omit<SlideInput, 'slide'> | undefined;
  readonly bibleAppearance:
    | (Pick<PictureSpec['appearance'], 'screen' | 'theme'> & {
        readonly background?: string | undefined;
      })
    | undefined;
  readonly switchSlot?: string | undefined;
}

interface SlidesPicture {
  readonly kind: 'slides';
  readonly item: SlidesItem;
  readonly index: number;
  readonly projection?:
    {readonly tiles: readonly SlideTile[]} | null | undefined;
  readonly part?: number | undefined;
  readonly outputSlide?: SlideLayer | null | undefined;
  readonly appearance: PictureSpec['appearance'];
}

interface TilePicture {
  readonly kind: 'tile';
  readonly tile: SlideTile;
  readonly slide: SlideLayer | null;
  readonly themes: TileThemes;
}

interface SequencePicture {
  readonly kind: 'sequence';
  readonly itemId: string;
  readonly index: number;
  readonly tiles: readonly SlideTile[];
  readonly themes: TileThemes;
}

/** The caller can distinguish standalone media from a slide with a background. */
export type PictureResult =
  | {readonly kind: 'slide'; readonly spec: PictureSpec}
  | {readonly kind: 'media'; readonly spec: PictureSpec};

function result(spec: PictureSpec, media = false): PictureResult {
  return media ? {kind: 'media', spec} : {kind: 'slide', spec};
}

export function pictureSpec(
  picture: PreparedPicture | SlidesPicture,
): PictureResult;
export function pictureSpec(
  picture: TilePicture | SequencePicture,
): PictureResult | undefined;
export function pictureSpec(
  picture: PreparedPicture | SlidesPicture | TilePicture | SequencePicture,
): PictureResult | undefined {
  if (picture.kind === 'sequence') {
    const tile = picture.tiles[picture.index];
    if (tile === undefined) return undefined;
    return pictureSpec({
      kind: 'tile',
      tile,
      slide: slideLayerOf(
        {itemId: picture.itemId, index: picture.index},
        () => picture.tiles,
      ),
      themes: picture.themes,
    });
  }
  if (picture.kind === 'slide') {
    return result(
      outputSlideSpec(picture.input),
      picture.input.mediaOnly === true,
    );
  }
  if (picture.kind === 'slides') {
    const layers = slideLayers(picture.item, picture.index, {
      projection: picture.projection,
      part: picture.part,
    });
    return result({
      layers:
        picture.outputSlide == null
          ? layers
          : {...layers, slide: picture.outputSlide},
      appearance: picture.appearance,
    });
  }
  if (picture.kind === 'layers') {
    return result(
      {layers: picture.layers, appearance: picture.appearance},
      picture.layers.slide === null && picture.layers.media !== null,
    );
  }
  const {
    tile,
    slide,
    themes: {theme, cardTheme, sermonTheme, bibleAppearance},
  } = picture;
  if (slide === null) return undefined;
  if (tile.media?.mediaId !== undefined) {
    return theme === undefined
      ? undefined
      : result(
          outputSlideSpec({
            ...theme,
            slide,
            background: tile.media.mediaId,
            mediaOnly: true,
          }),
          true,
        );
  }
  const content = {slide, songSource: tile.sourceSlide};
  if (tile.sectionCard !== undefined && cardTheme !== undefined) {
    return result(outputSlideSpec({...cardTheme, ...content}));
  }
  if (tile.sermonTitle === true && sermonTheme !== undefined) {
    return result(outputSlideSpec({...sermonTheme, ...content}));
  }
  const appearance = tile.biblePart === undefined ? undefined : bibleAppearance;
  if (appearance !== undefined) {
    return result(
      outputSlideSpec({
        ...biblePictureInput(slide, appearance, {
          sourceScreenId: appearance.theme.sourceScreenId,
          background: appearance.background,
        }),
        songSource: tile.sourceSlide,
      }),
    );
  }
  return theme === undefined
    ? undefined
    : result(outputSlideSpec({...theme, ...content}));
}
