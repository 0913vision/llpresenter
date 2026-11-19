import {useLayoutEffect, useState, type JSX} from 'react';
import {emptyLayers, type LiveLayers, type LiveState} from '@core/live/state';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import type {RenderFrame} from '@renderer/rendering/layer';
import {themeBackgroundColor} from '@renderer/rendering/themeBackground';
import {Picture} from '@renderer/rendering/pictures/Picture';
import {pictureBounds} from '@renderer/rendering/pictures/drawPicture';
import type {PictureSpec} from '@renderer/rendering/pictures/pictureService';
import {useLive} from '@renderer/session/live';
import {OutputMirror} from './OutputMirror';
import styles from './ScreenPreview.module.css';

const noLayers = emptyLayers();

/** A static slide can share the cached output picture. */
export function cachedScreenPicture(
  layers: LiveLayers,
  frame: RenderFrame,
  state: LiveState | null,
): PictureSpec | undefined {
  const {screen, theme} = frame;
  if (
    screen === undefined ||
    theme === undefined ||
    layers.slide === null ||
    layers.prop !== null ||
    layers.audio !== null ||
    layers.message !== null ||
    frame.blackScreen === true ||
    frame.testPattern === true ||
    frame.stageMessage != null ||
    (state?.clearEffects?.length ?? 0) !== 0 ||
    theme.layout.elements.some(
      element => element.kind === 'clock' || element.kind === 'timer',
    )
  ) {
    return undefined;
  }
  return {
    layers: {
      ...layers,
      media: layers.media === null ? null : {...layers.media, startedAt: 0},
    },
    appearance: {
      screen,
      theme,
      ...(frame.audience === undefined ? {} : {audience: frame.audience}),
      ...(frame.stageLyricLabelPosition === undefined
        ? {}
        : {stageLyricLabelPosition: frame.stageLyricLabelPosition}),
      background: themeBackgroundColor(
        theme.layout.background,
        theme.emptyColor,
      ),
      checker: false,
    },
  };
}

function reportDrawingError(message: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : '';
  window.llp?.log.write({level: 'error', message, detail});
}

/** Shows a cached still when possible and the actual output for dynamic states. */
export function ScreenPreview({
  screenId,
  chroma,
}: {
  readonly screenId: string;
  readonly chroma: boolean;
}): JSX.Element {
  const [snapshot, setSnapshot] = useState<{
    screenId: string;
    picture: PictureSpec | undefined;
  }>();
  const picture =
    snapshot?.screenId === screenId ? snapshot.picture : undefined;
  useLayoutEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let stopped = false;
    const holder: {frames?: ScreenFrames} = {};
    const update = (): void => {
      const frames = holder.frames;
      if (stopped || frames === undefined) return;
      const state = useLive.getState().state;
      try {
        const frame = frames.frame(state);
        setSnapshot({
          screenId,
          picture:
            frame === undefined
              ? undefined
              : cachedScreenPicture(state?.layers ?? noLayers, frame, state),
        });
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
  const classes = [styles.screen];
  if (chroma) classes.push(styles.chroma);
  const bounds = pictureBounds(picture?.appearance.screen.pictureSize);
  return (
    <div className={classes.join(' ')}>
      {picture === undefined ? (
        <OutputMirror screenId={screenId} />
      ) : (
        <div
          className={styles.picture}
          style={{
            width: `${(1920 / bounds.width) * 100}%`,
            height: `${(1080 / bounds.height) * 100}%`,
            left: `${(-bounds.x / bounds.width) * 100}%`,
            top: `${(-bounds.y / bounds.height) * 100}%`,
          }}
        >
          <Picture {...picture} />
        </div>
      )}
    </div>
  );
}
