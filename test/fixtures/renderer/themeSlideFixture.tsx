import type {JSX} from 'react';
import {emptyLayers, type SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeElementText} from '@core/themes/content';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {ThemePicture} from '@renderer/rendering/ThemePicture';
import {songTitleLayout} from '@core/themes/songTitle';
import type {RenderScreen} from '@renderer/rendering/layer';

/** Exercises the theme editor canvas with slide-shaped sample data. */
export function SlidePicture({
  slide,
  layout: sourceLayout,
  emptyColor = '#000000',
  item = null,
  background,
  screen,
}: {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor?: string;
  readonly item?: LiveThemeItem | null;
  readonly background?: string | undefined;
  readonly screen?: RenderScreen | undefined;
}): JSX.Element {
  const layout = songTitleLayout(sourceLayout, slide);
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
      measuredText={
        slide.biblePart === undefined
          ? undefined
          : {
              lines: slide.lines,
              continued: slide.continued ?? false,
              part: slide.biblePart,
            }
      }
      measuredNextText={
        slide.next?.biblePart === undefined
          ? undefined
          : {
              lines: slide.next.lines,
              continued: slide.next.continued ?? false,
              part: slide.next.biblePart,
            }
      }
      media={{
        ...(slide.picture === undefined
          ? {}
          : {media: mediaUrl(slide.picture)}),
        ...(background === undefined ||
        slide.picture !== undefined ||
        screen?.kind === 'stage' ||
        screen?.kind === 'broadcast'
          ? {}
          : {background: thumbnailSrc(background)}),
      }}
    />
  );
}
