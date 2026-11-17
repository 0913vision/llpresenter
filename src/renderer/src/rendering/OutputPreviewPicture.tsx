import {
  memo,
  useContext,
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
import {fontsLoading, previewReady} from './fontsLoading';
import type {RenderScreen, ThemeFrame} from './layer';
import styles from './OutputPreviewPicture.module.css';
import {PictureReadiness} from './PictureReadiness';
import {PicturePark} from './picturePark';

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
  readonly key: string;
  /** Drawn by this tile for its current props, not taken from the park. */
  readonly checked: boolean;
  readonly host: HTMLDivElement;
  readonly renderer: OutputRenderer;
  readonly dispose: () => void;
}

// NOTE(0913vision): about two 진행 grids of tiles. A tile that mounts again with
// the same picture key shows the parked view in its first frame, then always
// draws again behind it and swaps, so anything the key misses (a media file's
// fit, a font that arrived) is corrected within one drawing. Only views that
// finished drawing for their own props are parked.
const PARKED_PICTURES = 160;
const parked = new PicturePark<PictureView>(PARKED_PICTURES);

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
    const source = useRef({});
    const onReady = useContext(PictureReadiness);
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
      if (container === null) return;
      const key = pictureKey({layers, appearance});
      if (front.current?.key === key && front.current.checked) {
        container.dataset['previewReady'] = 'true';
        return;
      }
      if (front.current === null) {
        const kept = parked.take(key);
        if (kept !== undefined) {
          container.append(kept.host);
          front.current = {...kept, checked: false};
          onReady?.(source.current);
        }
      }
      const shown = front.current?.key === key;
      container.dataset['previewReady'] = shown ? 'true' : 'false';
      if (!near && onReady === null) return;
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
        key,
        checked: true,
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
          (!previewReady(renderer) || fontsLoading(document.fonts)) &&
          (!expired || onReady !== null)
        ) {
          frame = requestAnimationFrame(check);
          return;
        }
        if (expired) renderer.revealIncomplete();
        const previous = front.current;
        previous?.host.remove();
        host.style.visibility = 'visible';
        front.current = view;
        container.dataset['previewReady'] = 'true';
        previous?.dispose();
        onReady?.(source.current);
      };
      frame = requestAnimationFrame(check);
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        if (front.current !== view) view.dispose();
      };
    }, [layers, appearance, near, onReady]);
    useLayoutEffect(
      () => () => {
        const view = front.current;
        front.current = null;
        if (view === null) return;
        view.host.remove();
        if (view.checked && previewReady(view.renderer)) {
          parked.park(view.key, view);
        } else {
          view.dispose();
        }
      },
      [],
    );
    return (
      <div
        ref={parent}
        className={styles.screen}
        data-preview-ready={near ? 'false' : 'deferred'}
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
