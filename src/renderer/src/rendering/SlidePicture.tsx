import type {JSX} from 'react';
import type {SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {SongSlideSource} from '@core/schema/showService';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {OutputSlidePicture} from './OutputSlidePicture';
import type {ScreenId, ThemeId} from '@core/schema/ids';
import type {RenderScreen} from './layer';
import {usePrepPictureSwitch} from './PrepPictureSwitch';

/** Shared slide canvas for presentation tiles, item previews, and slide editors. */
export function SlidePicture({
  slide,
  layout: sourceLayout,
  emptyColor = '#000000',
  item = null,
  background,
  themeId,
  screen,
  sourceScreenId,
  songSource,
  mediaOnly = false,
  drawn,
  editing,
}: {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor?: string;
  readonly item?: LiveThemeItem | null;
  readonly background?: string | undefined;
  readonly output?: boolean;
  readonly themeId?: ThemeId | undefined;
  readonly screen?: RenderScreen | undefined;
  readonly sourceScreenId?: ScreenId | undefined;
  readonly songSource?: SongSlideSource | undefined;
  readonly mediaOnly?: boolean | undefined;
  /** Output pictures only: drawn through the picture service. */
  readonly drawn?: 'wait' | 'place' | undefined;
  readonly editing?: boolean | undefined;
}): JSX.Element {
  const switching = usePrepPictureSwitch();
  return (
    <OutputSlidePicture
      slide={slide}
      layout={sourceLayout}
      emptyColor={emptyColor}
      item={item}
      background={background}
      themeId={themeId}
      screen={screen}
      sourceScreenId={sourceScreenId}
      songSource={songSource}
      mediaOnly={mediaOnly}
      drawn={
        drawn ??
        (switching === undefined ? undefined : switching ? 'wait' : 'place')
      }
      editing={editing}
    />
  );
}
