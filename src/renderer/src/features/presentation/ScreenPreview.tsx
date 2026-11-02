import {useEffect, useRef, type JSX} from 'react';
import {emptyLayers} from '@core/live/state';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import {useLive} from '@renderer/session/live';
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
 * @param chroma - Draws the empty picture green, as the 방송 화면 does.
 */
export function ScreenPreview({
  screenId,
  chroma,
}: {
  readonly screenId: string;
  readonly chroma: boolean;
}): JSX.Element {
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return undefined;
    const renderer = new OutputRenderer(screen, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl,
      onError: reportDrawingError,
      mode: 'preview',
    });
    let frames: ScreenFrames | null = null;
    const draw = (): void => {
      const state = useLive.getState().state;
      const layers = state?.layers ?? noLayers;
      try {
        const frame = frames?.frame(state);
        if (frame !== undefined) renderer.render(layers, frame);
      } catch (error) {
        reportDrawingError('could not update the screen preview', error);
      }
    };
    const api = window.llp;
    frames =
      api === undefined
        ? null
        : new ScreenFrames({
            fonts: api.fonts,
            settings: api.settings,
            clock: () => api.live.clock(),
            screenId,
            onChange: draw,
            onError: reportDrawingError,
          });
    draw();
    const unsubscribe = useLive.subscribe((next, previous) => {
      if (next.state !== previous.state) draw();
    });
    return () => {
      unsubscribe();
      frames?.dispose();
      renderer.dispose();
    };
  }, [screenId]);

  const classes = [styles.screen];
  if (chroma) classes.push(styles.chroma);
  return <div ref={screenRef} className={classes.join(' ')} />;
}
