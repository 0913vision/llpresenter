import {useEffectEvent, useLayoutEffect, useRef, type JSX} from 'react';
import type {LiveLayers} from '@core/live/state';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {OutputRenderer} from './outputRenderer';
import {openPreviewMedia} from './previewMedia';
import type {RenderScreen, ThemeFrame} from './layer';
import styles from './OutputPreviewPicture.module.css';
import {THEME_LIMITS} from '@core/themes/elementRules';

/** A still, local composition drawn by the same renderer as output. */
export function OutputPreviewPicture({
  layers,
  appearance,
  thumbnail = false,
}: {
  readonly layers: LiveLayers;
  readonly appearance: {
    readonly screen: RenderScreen;
    readonly theme: ThemeFrame;
    readonly background: string;
    readonly checker: boolean;
  };
  readonly thumbnail?: boolean;
}): JSX.Element {
  const parent = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const renderer = useRef<OutputRenderer | null>(null);
  useLayoutEffect(() => {
    const frame = viewport.current;
    const canvas = parent.current;
    if (!thumbnail || frame === null || canvas === null) return;
    const resize = (): void => {
      canvas.style.transform = `scale(${frame.clientWidth / THEME_LIMITS.width})`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [thumbnail]);
  const draw = useEffectEvent(() => {
    try {
      renderer.current?.render(layers, {
        screen: appearance.screen,
        theme: appearance.theme,
        transitions: false,
        ...(layers.slide === null ? {} : {slide: layers.slide}),
      });
    } catch (error) {
      console.error('Could not update preview', error);
    }
  });
  useLayoutEffect(() => {
    if (parent.current === null) return;
    const previewMedia = openPreviewMedia(window.llp);
    const view = new OutputRenderer(parent.current, {
      transparent: appearance.screen.method === 'ndi',
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl,
      previewMedia,
      mode: 'preview',
      onError: (message, error) => console.error(message, error),
    });
    renderer.current = view;
    draw();
    return () => {
      renderer.current = null;
      view.dispose();
      previewMedia?.dispose();
    };
  }, [appearance.screen.method]);
  useLayoutEffect(() => {
    draw();
  }, [layers, appearance.screen, appearance.theme]);
  return (
    <div
      ref={viewport}
      className={styles.screen}
      style={{
        background:
          appearance.screen.method === 'ndi'
            ? 'transparent'
            : appearance.background,
      }}
      data-checker={appearance.checker || undefined}
    >
      <div
        ref={parent}
        className={thumbnail ? styles.reference : styles.canvas}
        style={
          thumbnail
            ? {width: THEME_LIMITS.width, height: THEME_LIMITS.height}
            : undefined
        }
      />
    </div>
  );
}
