import type {JSX} from 'react';
import {emptyLayers, type SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeElementText} from '@core/themes/content';
import {mediaUrl, thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {ThemePicture} from './ThemePicture';

/** Shared slide canvas for presentation tiles, item previews, and slide editors. */
export function SlidePicture({
  slide,
  layout,
  emptyColor = '#000000',
  item = null,
  background,
}: {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor?: string;
  readonly item?: LiveThemeItem | null;
  readonly background?: string | undefined;
}): JSX.Element {
  const layers = {...emptyLayers(), slide};
  const samples = Object.fromEntries(
    layout.elements.map(element => [
      element.kind,
      themeElementText(element, {layers, item}) ?? '',
    ]),
  );
  return (
    <ThemePicture
      elements={layout.mode.kind === 'own' ? layout.elements : []}
      background={layout.background ?? emptyColor}
      samples={samples}
      media={{
        ...(slide.picture === undefined
          ? {}
          : {media: mediaUrl(slide.picture)}),
        ...(background === undefined || slide.picture !== undefined
          ? {}
          : {background: thumbnailUrl(background)}),
      }}
    />
  );
}
