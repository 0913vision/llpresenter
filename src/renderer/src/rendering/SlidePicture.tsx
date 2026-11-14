import type {JSX} from 'react';
import {emptyLayers, type SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeElementText} from '@core/themes/content';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {ThemePicture} from './ThemePicture';
import {songTitleLayout} from '@core/themes/songTitle';
import {OutputSlidePicture} from './OutputSlidePicture';
import type {ThemeId} from '@core/schema/ids';
import type {RenderScreen} from './layer';

/** Shared slide canvas for presentation tiles, item previews, and slide editors. */
export function SlidePicture({
  slide,
  layout: sourceLayout,
  emptyColor = '#000000',
  item = null,
  background,
  output = false,
  themeId,
  screen,
  mediaOnly = false,
}: {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor?: string;
  readonly item?: LiveThemeItem | null;
  readonly background?: string | undefined;
  readonly output?: boolean;
  readonly themeId?: ThemeId | undefined;
  readonly screen?: RenderScreen | undefined;
  readonly mediaOnly?: boolean;
}): JSX.Element {
  if (output) {
    return (
      <OutputSlidePicture
        slide={slide}
        layout={sourceLayout}
        emptyColor={emptyColor}
        item={item}
        background={background}
        themeId={themeId}
        screen={screen}
        mediaOnly={mediaOnly}
      />
    );
  }
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
        ...(background === undefined || slide.picture !== undefined
          ? {}
          : {background: thumbnailSrc(background)}),
      }}
    />
  );
}
