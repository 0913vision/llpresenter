import {useEffectEvent, useLayoutEffect, useRef, type JSX} from 'react';
import type {ThemeId} from '@core/schema/ids';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import type {RenderScreen} from './layer';
import {ThemeCompositionView} from './themeComposition';
import {openPreviewMedia} from './previewMedia';
import styles from './ThemePicture.module.css';
import {emptyLayers, type SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeElementText} from '@core/themes/content';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {ThemePicture} from './ThemePicture';
import {songTitleLayout} from '@core/themes/songTitle';

/** Shared slide canvas for presentation tiles, item previews, and slide editors. */
export function SlidePicture({
  slide,
  layout: sourceLayout,
  emptyColor = '#000000',
  item = null,
  background,
  exact = false,
  screen,
  themeId,
}: {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor?: string;
  readonly item?: LiveThemeItem | null;
  readonly background?: string | undefined;
  readonly exact?: boolean;
  readonly screen?: RenderScreen;
  readonly themeId?: ThemeId;
}): JSX.Element {
  if (exact && screen !== undefined && themeId !== undefined) {
    return (
      <ExactSlidePicture
        slide={slide}
        layout={sourceLayout}
        emptyColor={emptyColor}
        item={item}
        background={background}
        screen={screen}
        themeId={themeId}
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

function ExactSlidePicture({
  slide,
  layout,
  emptyColor,
  item,
  background,
  screen,
  themeId,
}: {
  readonly slide: SlideLayer;
  readonly layout: ThemeScreenLayout;
  readonly emptyColor: string;
  readonly item: LiveThemeItem | null;
  readonly background: string | undefined;
  readonly screen: RenderScreen;
  readonly themeId: ThemeId;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<ThemeCompositionView | null>(null);
  const draw = useEffectEvent(() => {
    const picture = slide.picture;
    const media = picture ?? background;
    const layers = {
      ...emptyLayers(),
      slide,
      media:
        media === undefined
          ? null
          : {
              mediaId: media,
              loop: picture === undefined,
              startedAt: 0,
              ...(picture === undefined
                ? {}
                : {itemId: slide.itemId, slidePicture: true as const}),
            },
    };
    try {
      renderer.current?.render(layers, {
        slide,
        screen,
        transitions: false,
        theme: {
          themeId,
          revision: 0,
          missing: [],
          sourceScreenId: screen.id,
          layout,
          emptyColor,
          item,
        },
      });
    } catch (error) {
      console.error('Could not update slide picture', error);
    }
  });
  useLayoutEffect(() => {
    if (host.current === null) return undefined;
    const media = openPreviewMedia(window.llp);
    const view = new ThemeCompositionView(host.current, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl,
      previewMedia: media,
      mode: 'preview',
      transparent: screen.method === 'ndi',
      onError: (message, error) => console.error(message, error),
    });
    renderer.current = view;
    draw();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => view.rescale());
    observer?.observe(host.current);
    return () => {
      observer?.disconnect();
      renderer.current = null;
      view.dispose();
      media?.dispose();
    };
  }, [screen.method]);
  useLayoutEffect(() => {
    draw();
  }, [slide, layout, emptyColor, item, background, screen, themeId]);
  return <div ref={host} className={styles.picture} />;
}
