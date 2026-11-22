import {useLayoutEffect, useState, type JSX} from 'react';
import {emptyLayers} from '@core/live/state';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import {Still} from '@renderer/pictures/SlidePicture';
import type {StillPicture} from '@renderer/rendering/slideStill';
import {themeBackgroundColor} from '@renderer/rendering/themeBackground';
import {useLive} from '@renderer/session/live';
import {classNames} from '@renderer/ui/classNames';
import styles from './ScreenPreview.module.css';

const noLayers = emptyLayers();

function reportDrawingError(message: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : '';
  window.llp?.log.write({level: 'error', message, detail});
}

interface Snapshot {
  readonly screenId: string;
  readonly black: boolean;
  readonly picture: StillPicture | undefined;
}

function snapshotOf(
  screenId: string,
  frame: ReturnType<ScreenFrames['frame']>,
  layers: StillPicture['layers'],
): Snapshot {
  const {screen, theme} = frame ?? {};
  return {
    screenId,
    black: frame?.blackScreen === true,
    picture:
      screen === undefined || theme === undefined
        ? undefined
        : {
            layers,
            appearance: {
              screen,
              theme,
              audience: frame?.audience,
              ...(frame?.stageLyricLabelPosition === undefined
                ? {}
                : {stageLyricLabelPosition: frame.stageLyricLabelPosition}),
              background: themeBackgroundColor(
                theme.layout.background,
                theme.emptyColor,
              ),
            },
          },
  };
}

/** What a screen that is off would show now. */
export function ScreenPreview({
  screenId,
  chroma,
}: {
  readonly screenId: string;
  readonly chroma: boolean;
}): JSX.Element {
  const [state, setState] = useState<Snapshot>();
  useLayoutEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let stopped = false;
    const holder: {frames?: ScreenFrames} = {};
    const update = (): void => {
      const {frames} = holder;
      if (stopped || frames === undefined) return;
      const live = useLive.getState().state;
      try {
        setState(
          snapshotOf(screenId, frames.frame(live), live?.layers ?? noLayers),
        );
      } catch (error) {
        reportDrawingError('could not update the screen preview', error);
      }
    };
    const frames = new ScreenFrames({
      fonts: api.fonts,
      settings: api.settings,
      clock: () => api.live.clock(),
      wallClock: api.live,
      screenId,
      onChange: update,
      onError: reportDrawingError,
    });
    holder.frames = frames;
    update();
    const stopLive = useLive.subscribe((next, previous) => {
      if (next.state !== previous.state) update();
    });
    return () => {
      stopped = true;
      stopLive();
      frames.dispose();
    };
  }, [screenId]);
  const shown = state?.screenId === screenId ? state : undefined;
  return (
    <div className={classNames(styles.screen, chroma && styles.chroma)}>
      {shown?.black === true ? (
        <div className={styles.black} data-black-screen />
      ) : shown?.picture === undefined ? null : (
        <Still {...shown.picture} />
      )}
    </div>
  );
}
