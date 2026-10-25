import {useEffect, useRef, type JSX} from 'react';
import {emptyLayers} from '@shared/live';
import {mediaUrl} from '@shared/media';
import {DEFAULT_LYRIC_STYLE} from '@renderer/render/lyricStyle';
import {OutputRenderer} from '@renderer/render/outputRenderer';
import {useLive} from '@renderer/state/live';
import styles from './ScreenPreview.module.css';

const noLayers = emptyLayers();

function reportDrawingError(message: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : '';
  window.llp?.log.write({level: 'error', message, detail});
}

/**
 * The picture of one screen: the output renderer, scaled into its parent frame,
 * fed with the live layers. It draws what the live state holds, never the
 * selection, and a change of the live state does not render React.
 *
 * @param chroma - Draws the empty picture green, as the 방송 자막 does.
 */
export function ScreenPreview({
  chroma,
}: {
  readonly chroma: boolean;
}): JSX.Element {
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return undefined;
    // TODO(0913vision): Take the lyric style from the current Look, and draw
    // the stage layout on the 무대 화면, once the Look reaches the renderer.
    const renderer = new OutputRenderer(screen, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl,
      onError: reportDrawingError,
      mode: 'preview',
    });
    const draw = (): void =>
      renderer.render(useLive.getState().state?.layers ?? noLayers);
    draw();
    const unsubscribe = useLive.subscribe((next, previous) => {
      if (next.state !== previous.state) draw();
    });
    return () => {
      unsubscribe();
      renderer.dispose();
    };
  }, []);

  const classes = [styles.screen];
  if (chroma) classes.push(styles.chroma);
  return <div ref={screenRef} className={classes.join(' ')} />;
}
