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
import {fontsLoading, fontsStamp, previewReady} from './fontsLoading';
import type {RenderScreen, ThemeFrame} from './layer';
import styles from './OutputPreviewPicture.module.css';
import {PictureReadiness} from './PictureReadiness';
import {PicturePark} from './picturePark';

interface PictureProps {
  readonly layers: LiveLayers;
  readonly liveText?: boolean | undefined;
  readonly appearance: {
    readonly screen: RenderScreen;
    readonly theme: ThemeFrame;
    readonly background: string;
    readonly checker: boolean;
  };
}

interface PictureView {
  key: string;
  readonly textKey: string;
  readonly host: HTMLDivElement;
  readonly renderer: OutputRenderer;
  /** What the drawing read beyond its key: media records and the font set. */
  readonly inputs: () => string;
  /** The inputs when the view was parked. */
  stamp: string;
  readonly dispose: () => void;
}

// NOTE(0913vision): about two 진행 grids of tiles. A tile that mounts again
// takes a parked view only when its key and every other input the drawing read
// (the media records it asked for, the font set) are unchanged, so the parked
// picture is exactly what a new drawing would show and nothing is drawn again;
// otherwise the view is dropped and the tile draws anew. Only finished views
// are parked.
const PARKED_PICTURES = 160;
const parked = new PicturePark<PictureView>(PARKED_PICTURES);

const NEAR_MARGIN = 200;

function scrollParent(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent !== null) {
    if (/auto|scroll/.test(getComputedStyle(parent).overflowY)) return parent;
    parent = parent.parentElement;
  }
  return null;
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

function textKey({layers, appearance}: PictureProps): string {
  return pictureKey({
    layers: {
      ...layers,
      slide: layers.slide === null ? null : {...layers.slide, lines: []},
    },
    appearance,
  });
}

/** A still, local composition drawn by the same renderer as output. */
export const OutputPreviewPicture = memo(
  ({layers, appearance, liveText}: PictureProps): JSX.Element => {
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
      // NOTE(0913vision): Near means within the margin of the scroll
      // viewport the picture sits in, so the tiles just below a grid draw
      // before scrolling brings them into view.
      const observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            setNear(true);
            observer.disconnect();
          }
        },
        {root: scrollParent(node), rootMargin: `${NEAR_MARGIN}px`},
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, []);
    useLayoutEffect(() => {
      const container = parent.current;
      if (container === null) return;
      const key = pictureKey({layers, appearance});
      const compatibleText = textKey({layers, appearance});
      if (front.current?.key === key) {
        container.dataset['previewReady'] = 'true';
        return;
      }
      if (
        liveText === true &&
        front.current !== null &&
        front.current.textKey === compatibleText &&
        previewReady(front.current.renderer) &&
        !fontsLoading(document.fonts)
      ) {
        front.current.renderer.render(layers, {
          screen: appearance.screen,
          theme: appearance.theme,
          transitions: false,
          ...(layers.slide === null ? {} : {slide: layers.slide}),
        });
        front.current.key = key;
        container.dataset['previewReady'] = 'true';
        onReady?.(source.current);
        return;
      }
      if (front.current === null) {
        const kept = parked.take(key);
        if (kept !== undefined && kept.stamp === kept.inputs()) {
          container.append(kept.host);
          front.current = kept;
          container.dataset['previewReady'] = 'true';
          onReady?.(source.current);
          return;
        }
        kept?.dispose();
      }
      if (!near && onReady === null) return;
      container.dataset['previewReady'] = 'false';
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
      const asked = new Set<string>();
      const renderer = new OutputRenderer(host, {
        transparent: appearance.screen.method === 'ndi',
        textStyle: DEFAULT_TEXT_STYLE,
        mediaUrl,
        previewMedia:
          media === undefined
            ? undefined
            : {
                url: id => {
                  asked.add(id);
                  return media.url(id);
                },
                remaining: layer => media.remaining(layer),
              },
        mode: 'preview',
        onError: (message, error) => console.error(message, error),
      });
      const view: PictureView = {
        key,
        textKey: compatibleText,
        host,
        renderer,
        inputs: () =>
          JSON.stringify([
            fontsStamp(document.fonts),
            media?.describe([...asked].sort()) ?? '',
          ]),
        stamp: '',
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
        // NOTE(0913vision): A finished picture stops hiding itself rather than
        // forcing itself visible, so a picture prepared inside a hidden stage
        // (the next item's grid, pictures drawn ahead) stays out of sight.
        host.style.removeProperty('visibility');
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
    }, [layers, appearance, liveText, near, onReady]);
    useLayoutEffect(
      () => () => {
        const view = front.current;
        front.current = null;
        if (view === null) return;
        view.host.remove();
        if (previewReady(view.renderer) && !fontsLoading(document.fonts)) {
          view.stamp = view.inputs();
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
  (previous, next) =>
    previous.liveText === next.liveText &&
    pictureKey(previous) === pictureKey(next),
);
