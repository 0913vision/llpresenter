import {useEffect, useRef, type JSX} from 'react';
import {emptyLayers} from '@core/live/state';
import {mediaUrl} from '@contracts/ipc/media';
import {DEFAULT_LYRIC_STYLE} from '@renderer/render/lyricStyle';
import {OutputRenderer} from '@renderer/render/outputRenderer';
import {ScreenFrames} from '@renderer/render/screenFrames';
import type {LookGap} from '@renderer/render/screenLook';
import {useLive} from '@renderer/platform/live';
import styles from './ScreenPreview.module.css';

const noLayers = emptyLayers();

function reportDrawingError(message: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : '';
  window.llp?.log.write({level: 'error', message, detail});
}

function reportLookGap(message: string, {kind, id}: LookGap): void {
  window.llp?.log.write({level: 'warn', message, detail: `${kind} ${id}`});
}

/**
 * The picture of one screen: the output renderer, scaled into its parent frame,
 * fed with the live layers. It draws what the live state holds, never the
 * selection, and a change of the live state does not render React.
 *
 * @param chroma - Draws the empty picture green, as the 방송 자막 does.
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
    // TODO(0913vision): Draw the stage layout on the 무대 화면 once stage
    // layouts reach the renderer (M3-O5).
    const renderer = new OutputRenderer(screen, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl,
      onError: reportDrawingError,
      mode: 'preview',
    });
    let frames: ScreenFrames | null = null;
    const draw = (): void => {
      const state = useLive.getState().state;
      const layers = state?.layers ?? noLayers;
      const frame = frames?.frame(state);
      if (frame === undefined) renderer.render(layers);
      else renderer.render(layers, frame);
    };
    const api = window.llp;
    frames =
      api === undefined
        ? null
        : new ScreenFrames({
            settings: api.settings,
            clock: () => api.live.clock(),
            screenId,
            onChange: draw,
            onError: reportDrawingError,
            onGap: reportLookGap,
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
