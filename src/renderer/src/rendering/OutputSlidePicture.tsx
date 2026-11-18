import type {JSX} from 'react';
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
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeBackgroundColor} from './themeBackground';
import {OutputPreviewPicture} from './OutputPreviewPicture';
import {Picture} from './pictures/Picture';
import type {PictureSpec} from './pictures/pictureService';
import type {RenderScreen} from './layer';

const screenId = createScreenId(STARTER_SCREEN_IDS.main);
const defaultThemeId = createThemeId('00000000-0000-4000-8000-000000000001');

interface SlideInput {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor: string;
  readonly item: LiveThemeItem | null;
  readonly background?: string | undefined;
  readonly themeId?: ThemeId | undefined;
  readonly screen?: RenderScreen | undefined;
  readonly sourceScreenId?: ScreenId | undefined;
  readonly songSource?: SongSlideSource | undefined;
  readonly mediaOnly?: boolean | undefined;
}

/** What the output compositor draws for a prepared slide. */
export function slideSpec({
  slide,
  layout,
  emptyColor,
  item,
  background,
  themeId,
  screen = {id: screenId, kind: 'audience', method: 'fullscreen'},
  sourceScreenId = screen.id,
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
              ...(slide.picture === undefined || slide.kind === undefined
                ? {}
                : {itemId: slide.itemId, slidePicture: true}),
            },
    },
    appearance: {
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
      background: themeBackgroundColor(layout.background, emptyColor),
      checker: false,
    },
  };
}

/** Displays the compositor's shared image of a prepared slide. */
export function OutputSlidePicture({
  drawn,
  editing = false,
  ...input
}: SlideInput & {
  /**
   * Draws through the picture service: `wait` holds the view until the picture
   * is drawn (a view switching to new content), `place` draws it where it shows.
   */
  readonly drawn?: 'wait' | 'place' | undefined;
  readonly editing?: boolean | undefined;
}): JSX.Element {
  const spec = slideSpec(input);
  return drawn === undefined && !editing ? (
    <OutputPreviewPicture {...spec} />
  ) : (
    <Picture wait={drawn === 'wait'} editing={editing} {...spec} />
  );
}
