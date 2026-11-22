import {emptyLayers, type SlideLayer} from '@core/live/state';
import {
  createScreenId,
  createThemeId,
  type ScreenId,
  type ThemeId,
} from '@core/schema/ids';
import type {SectionCard} from '@core/schema/service';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import type {SlideTexts} from '@core/schema/slideTexts';
import type {SongSlide} from '@core/schema/song';
import {themeBackgroundColor} from './themeBackground';
import type {RenderFrame, RenderScreen} from './layer';
import type {StillPicture} from './slideStill';

const screenId = createScreenId(STARTER_SCREEN_IDS.main);
const defaultThemeId = createThemeId('00000000-0000-4000-8000-000000000001');

/** A slide with its screen and theme already resolved. */
export interface SlideInput {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor?: string;
  readonly item?: LiveThemeItem | null;
  readonly background?: string | undefined;
  readonly themeId?: ThemeId | undefined;
  readonly screen?: RenderScreen | undefined;
  readonly sourceScreenId?: ScreenId | undefined;
  readonly audience?: RenderFrame['audience'];
  readonly stageLyricLabelPosition?: RenderFrame['stageLyricLabelPosition'];
  readonly mediaOnly?: boolean | undefined;
}

/** What the composition draws for a slide. */
export function slideStillSpec({
  slide,
  layout,
  emptyColor = '#000000',
  item = null,
  background,
  themeId,
  screen = {id: screenId, kind: 'audience', method: 'fullscreen'},
  sourceScreenId = screen.id,
  audience,
  stageLyricLabelPosition,
  mediaOnly = false,
}: SlideInput): StillPicture {
  const mediaId = slide.picture ?? background;
  return {
    layers: {
      ...emptyLayers(),
      slide: mediaOnly ? null : slide,
      media:
        mediaId === undefined
          ? null
          : {
              mediaId,
              loop: slide.picture === undefined || slide.kind === undefined,
              startedAt: 0,
              ...(slide.picture === undefined || slide.kind === undefined
                ? {}
                : {itemId: slide.itemId, slidePicture: true}),
            },
    },
    appearance: {
      background: themeBackgroundColor(layout.background, emptyColor),
      screen,
      theme: {
        themeId: themeId ?? defaultThemeId,
        revision: 0,
        missing: [],
        sourceScreenId,
        layout,
        emptyColor,
        item,
      },
      audience,
      ...(stageLyricLabelPosition === undefined
        ? {}
        : {stageLyricLabelPosition}),
    },
  };
}

/** The layer of a song slide that is being edited. */
export function songSlideLayer(
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
  > & {readonly texts?: SlideTexts | undefined},
): SlideLayer {
  return {
    itemId,
    position,
    lines: slide.lines,
    label: slide.label ?? null,
    ...(slide.texts === undefined ? {} : {texts: slide.texts}),
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

/** The layer of an item's opening title card. */
export function cardSlideLayer(
  itemId: string,
  card: SectionCard,
  texts?: SlideTexts,
): SlideLayer {
  return {
    itemId,
    position: 0,
    label: card.name,
    lines: [card.english],
    sectionCard: card,
    ...(texts === undefined ? {} : {texts}),
  };
}
