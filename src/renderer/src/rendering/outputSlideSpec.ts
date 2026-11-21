import {emptyLayers, type SlideLayer} from '@core/live/state';
import {
  createScreenId,
  createThemeId,
  type ScreenId,
  type ThemeId,
} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {SongSlideSource} from '@core/schema/showService';
import type {Song} from '@core/schema/song';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeBackgroundColor} from './themeBackground';
import type {PictureSpec} from './pictures/pictureService';
import type {RenderScreen} from './layer';

const screenId = createScreenId(STARTER_SCREEN_IDS.main);
const defaultThemeId = createThemeId('00000000-0000-4000-8000-000000000001');

export interface SlideInput {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor: string;
  readonly item: LiveThemeItem | null;
  readonly background?: string | undefined;
  readonly backgroundFrame?: Song['backgroundFrame'];
  readonly themeId?: ThemeId | undefined;
  readonly screen?: RenderScreen | undefined;
  readonly sourceScreenId?: ScreenId | undefined;
  readonly audience?: PictureSpec['appearance']['audience'] | undefined;
  readonly stageLyricLabelPosition?:
    PictureSpec['appearance']['stageLyricLabelPosition'] | undefined;
  readonly songSource?: SongSlideSource | undefined;
  readonly mediaOnly?: boolean | undefined;
}

/** What the output compositor draws for a prepared slide. */
export function outputSlideSpec({
  slide,
  layout,
  emptyColor,
  item,
  background,
  backgroundFrame,
  themeId,
  screen = {id: screenId, kind: 'audience', method: 'fullscreen'},
  sourceScreenId = screen.id,
  audience,
  stageLyricLabelPosition,
  songSource,
  mediaOnly = false,
}: SlideInput): PictureSpec {
  const mediaId = slide.picture ?? background;
  return {
    songSource,
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
              ...(slide.picture === undefined && backgroundFrame !== undefined
                ? {backgroundFrame}
                : {}),
              ...(slide.picture === undefined || slide.kind === undefined
                ? {}
                : {itemId: slide.itemId, slidePicture: true}),
            },
    },
    appearance: {
      screen,
      ...(audience === undefined ? {} : {audience}),
      ...(stageLyricLabelPosition === undefined
        ? {}
        : {stageLyricLabelPosition}),
      theme: {
        themeId: themeId ?? defaultThemeId,
        revision: 0,
        missing: [],
        sourceScreenId,
        layout,
        emptyColor,
        item,
      },
      background: themeBackgroundColor(layout.background, emptyColor),
      checker: false,
    },
  };
}
