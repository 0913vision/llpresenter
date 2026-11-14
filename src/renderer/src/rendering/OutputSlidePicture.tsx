import type {JSX} from 'react';
import {emptyLayers, type SlideLayer} from '@core/live/state';
import {createScreenId, createThemeId, type ThemeId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeBackgroundColor} from './themeBackground';
import {OutputPreviewPicture} from './OutputPreviewPicture';
import type {RenderScreen} from './layer';

const screenId = createScreenId(STARTER_SCREEN_IDS.main);
const defaultThemeId = createThemeId('00000000-0000-4000-8000-000000000001');

/** Draws a prepared slide with the output compositor rather than an SVG approximation. */
export function OutputSlidePicture({
  slide,
  layout,
  emptyColor,
  item,
  background,
  themeId,
  screen = {id: screenId, kind: 'audience', method: 'fullscreen'},
  mediaOnly = false,
}: {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor: string;
  readonly item: LiveThemeItem | null;
  readonly background?: string | undefined;
  readonly themeId?: ThemeId | undefined;
  readonly screen?: RenderScreen | undefined;
  readonly mediaOnly?: boolean;
}): JSX.Element {
  const mediaId = slide.picture ?? background;
  return (
    <OutputPreviewPicture
      layers={{
        ...emptyLayers(),
        slide: mediaOnly ? null : slide,
        media:
          mediaId === undefined
            ? null
            : {
                mediaId,
                loop: slide.picture === undefined,
                startedAt: 0,
                ...(slide.picture === undefined
                  ? {}
                  : {itemId: slide.itemId, slidePicture: true}),
              },
      }}
      appearance={{
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
      }}
    />
  );
}
