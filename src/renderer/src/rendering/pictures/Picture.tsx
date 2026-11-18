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
import {
  pictureKey,
  pictures,
  type PictureSpec,
  type PictureService,
} from './pictureService';
import styles from './Picture.module.css';

interface PictureProps {
  /**
   * Waits for the drawing, holding the view that shows the picture: for a view
   * switching to new content. Otherwise the picture draws where it shows.
   */
  readonly wait?: boolean;
  readonly service?: PictureService | undefined;
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
  ({
    wait = false,
    service = pictures,
    layers,
    appearance,
  }: PictureProps): JSX.Element => {
    const spec = useMemo<PictureSpec>(
      () => ({layers, appearance}),
      [layers, appearance],
    );
    const shown = useDeferredValue(spec);
    if (wait && !service.drawInPlace) use(service.whenDrawn(shown));
    const container = useRef<HTMLDivElement>(null);
    const release = useRef<(() => void) | null>(null);
    useLayoutEffect(() => {
      const node = container.current;
      if (node === null) return;
      // NOTE(0913vision): The picture shown so far stays until the next one
      // is finished, so a change shows as one swap.
      release.current = service.show(shown, node, release.current ?? undefined);
    }, [service, shown]);
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
    previous.wait === next.wait &&
    previous.service === next.service &&
    pictureKey(previous) === pictureKey(next),
);
