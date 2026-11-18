import {useEffect, type JSX} from 'react';
import {emptyLayers, type SlideLayer} from '@core/live/state';
import {createScreenId, createThemeId, type ThemeId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeBackgroundColor} from './themeBackground';
import {OutputPreviewPicture} from './OutputPreviewPicture';
import {Picture} from './pictures/Picture';
import {pictures, type PictureSpec} from './pictures/pictureService';
import type {RenderScreen} from './layer';

const screenId = createScreenId(STARTER_SCREEN_IDS.main);
const defaultThemeId = createThemeId('00000000-0000-4000-8000-000000000001');

export interface SlideInput {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor: string;
  readonly item: LiveThemeItem | null;
  readonly background?: string | undefined;
  readonly themeId?: ThemeId | undefined;
  readonly screen?: RenderScreen | undefined;
  readonly mediaOnly?: boolean | undefined;
}

/** What the output compositor draws for a prepared slide. */
export function outputSlideSpec({
  slide,
  layout,
  emptyColor,
  item,
  background,
  themeId,
  screen = {id: screenId, kind: 'audience', method: 'fullscreen'},
  mediaOnly = false,
}: SlideInput): PictureSpec {
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
      screen,
      theme: {
        themeId: themeId ?? defaultThemeId,
        revision: 0,
        missing: [],
        sourceScreenId: screen.id,
        layout,
        emptyColor,
        item,
      },
      background: themeBackgroundColor(layout.background, emptyColor),
      checker: false,
    },
  };
}

/** Draws a picture ahead, out of sight, for a view likely to show it next. */
function PreparedPicture({spec}: {readonly spec: PictureSpec}): null {
  useEffect(() => {
    pictures.prepare([spec]);
  }, [spec]);
  return null;
}

/** Draws a prepared slide with the output compositor rather than an SVG approximation. */
export function OutputSlidePicture({
  drawn,
  prepareOnly = false,
  liveText = false,
  ...input
}: SlideInput & {
  /**
   * Draws through the picture service: `wait` holds the view until the picture
   * is drawn (a view switching to new content), `place` draws it where it shows.
   */
  readonly drawn?: 'wait' | 'place' | undefined;
  /** Only draws the picture ahead, showing nothing. */
  readonly prepareOnly?: boolean | undefined;
  readonly liveText?: boolean | undefined;
}): JSX.Element | null {
  const spec = outputSlideSpec(input);
  if (prepareOnly) return <PreparedPicture spec={spec} />;
  return drawn === undefined ? (
    <OutputPreviewPicture {...spec} liveText={liveText} />
  ) : (
    <Picture wait={drawn === 'wait'} {...spec} />
  );
}
