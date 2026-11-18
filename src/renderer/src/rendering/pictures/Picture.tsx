import {
  memo,
  use,
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  type JSX,
} from 'react';
import type {LiveLayers} from '@core/live/state';
import type {RenderScreen, ThemeFrame} from '../layer';
import {pictureKey, pictures, type PictureSpec} from './pictureService';
import styles from './Picture.module.css';

interface PictureProps {
  /**
   * Waits for the drawing, holding the view that shows the picture: for a view
   * switching to new content. Otherwise the picture draws where it shows.
   */
  readonly wait?: boolean;
  readonly layers: LiveLayers;
  readonly appearance: {
    readonly screen: RenderScreen;
    readonly theme: ThemeFrame;
    readonly background: string;
    readonly checker: boolean;
  };
}

/**
 * A slide picture that shows only once it is drawn. While it draws, the view
 * around it waits: a view switch keeps the previous view on screen, and a
 * picture whose content changes keeps its previous drawing until the new one
 * is finished.
 */
export const Picture = memo(
  ({wait = false, layers, appearance}: PictureProps): JSX.Element => {
    const spec = useMemo<PictureSpec>(
      () => ({layers, appearance}),
      [layers, appearance],
    );
    const shown = useDeferredValue(spec);
    if (wait && !pictures.drawInPlace) use(pictures.whenDrawn(shown));
    const container = useRef<HTMLDivElement>(null);
    const release = useRef<(() => void) | null>(null);
    useLayoutEffect(() => {
      const node = container.current;
      if (node === null) return;
      // NOTE(0913vision): The picture shown so far stays until the next one
      // is finished, so a change shows as one swap.
      release.current = pictures.show(
        shown,
        node,
        release.current ?? undefined,
      );
    }, [shown]);
    useLayoutEffect(
      () => () => {
        release.current?.();
        release.current = null;
      },
      [],
    );
    return (
      <div
        ref={container}
        className={styles.screen}
        data-checker={shown.appearance.checker || undefined}
      />
    );
  },
  (previous, next) =>
    previous.wait === next.wait && pictureKey(previous) === pictureKey(next),
);
