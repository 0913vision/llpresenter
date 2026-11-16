import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
} from 'react';
import type {LiveLayers} from '@core/live/state';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {OutputRenderer} from './outputRenderer';
import {openPreviewMedia} from './previewMedia';
import type {RenderScreen, ThemeFrame} from './layer';
import styles from './OutputPreviewPicture.module.css';

interface PictureProps {
  readonly layers: LiveLayers;
  readonly appearance: {
    readonly screen: RenderScreen;
    readonly theme: ThemeFrame;
    readonly background: string;
    readonly checker: boolean;
  };
}

interface PictureView {
  readonly host: HTMLDivElement;
  readonly renderer: OutputRenderer;
  readonly dispose: () => void;
}

const layouts = new WeakMap<object, string>();

function layoutKey(layout: ThemeFrame['layout']): string {
  let key = layouts.get(layout);
  if (key === undefined) {
    key = JSON.stringify(layout);
    layouts.set(layout, key);
  }
  return key;
}

function pictureKey({layers, appearance}: PictureProps): string {
  return JSON.stringify([
    layers.slide,
    layers.media,
    appearance.screen,
    appearance.theme.themeId,
    appearance.theme.revision,
    appearance.theme.item,
    appearance.theme.emptyColor,
    layoutKey(appearance.theme.layout),
    appearance.background,
    appearance.checker,
  ]);
}

/** A still, local composition drawn by the same renderer as output. */
export const OutputPreviewPicture = memo(
  ({layers, appearance}: PictureProps): JSX.Element => {
    const parent = useRef<HTMLDivElement>(null);
    const front = useRef<PictureView | null>(null);
    const [near, setNear] = useState(
      typeof IntersectionObserver === 'undefined',
    );
    useEffect(() => {
      const node = parent.current;
      if (node === null || typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            setNear(true);
            observer.disconnect();
          }
        },
        {rootMargin: '200px'},
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, []);
    useLayoutEffect(() => {
      const container = parent.current;
      if (container === null || !near) return;
      const host = document.createElement('div');
      Object.assign(host.style, {
        position: 'absolute',
        inset: '0',
        visibility: 'hidden',
        background:
          appearance.screen.method === 'ndi'
            ? 'transparent'
            : appearance.background,
      });
      container.append(host);
      const media = openPreviewMedia(window.llp);
      const renderer = new OutputRenderer(host, {
        transparent: appearance.screen.method === 'ndi',
        textStyle: DEFAULT_TEXT_STYLE,
        mediaUrl,
        previewMedia: media,
        mode: 'preview',
        onError: (message, error) => console.error(message, error),
      });
      const view: PictureView = {
        host,
        renderer,
        dispose: () => {
          renderer.dispose();
          media?.dispose();
          host.remove();
        },
      };
      let cancelled = false;
      let frame = 0;
      const started = performance.now();
      renderer.render(layers, {
        screen: appearance.screen,
        theme: appearance.theme,
        transitions: false,
        ...(layers.slide === null ? {} : {slide: layers.slide}),
      });
      const check = (): void => {
        if (cancelled) return;
        const expired =
          performance.now() - started >= OUTPUT_REVEAL_DEADLINE_MS;
        if (
          (!renderer.ready() || document.fonts.status !== 'loaded') &&
          !expired
        ) {
          frame = requestAnimationFrame(check);
          return;
        }
        if (expired) renderer.revealIncomplete();
        const previous = front.current;
        previous?.host.remove();
        host.style.visibility = 'visible';
        front.current = view;
        previous?.dispose();
      };
      frame = requestAnimationFrame(check);
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        if (front.current !== view) view.dispose();
      };
    }, [layers, appearance, near]);
    useLayoutEffect(
      () => () => {
        front.current?.dispose();
        front.current = null;
      },
      [],
    );
    return (
      <div
        ref={parent}
        className={styles.screen}
        style={{
          background:
            appearance.screen.method === 'ndi'
              ? 'transparent'
              : appearance.background,
        }}
        data-checker={appearance.checker || undefined}
      />
    );
  },
  (previous, next) => pictureKey(previous) === pictureKey(next),
);
