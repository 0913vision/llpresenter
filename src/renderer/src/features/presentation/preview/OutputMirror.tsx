import {THEME_CANVAS} from '@core/schema/screens/screens';
import {useEffect, useRef, type JSX} from 'react';
import {pictureBounds} from '@core/screens';
import {MirrorFeed, PREVIEW_HEIGHT, PREVIEW_WIDTH} from './mirrorFeed';
import styles from './OutputMirror.module.css';

/**
 * Tells whether the window is minimized, now and on every change; a window
 * without that API counts as shown.
 *
 * @returns A function that stops following.
 */
function followMinimized(onChange: (minimized: boolean) => void): () => void {
  const windowApi = window.llp?.window;
  if (windowApi === undefined) {
    onChange(false);
    return () => undefined;
  }
  let receivedEvent = false;
  const unsubscribe = windowApi.onMinimized(value => {
    receivedEvent = true;
    onChange(value);
  });
  windowApi.minimized().then(
    value => {
      if (!receivedEvent) onChange(value);
    },
    () => {
      if (!receivedEvent) onChange(false);
    },
  );
  return unsubscribe;
}

/** A stream of the actual output web contents; no second picture renderer. */
export function OutputMirror({
  screenId,
  targetKind,
  cropSize,
}: {
  readonly screenId: string;
  readonly targetKind?: string | undefined;
  readonly cropSize?:
    {readonly width: number; readonly height: number} | undefined;
}): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const video = ref.current;
    const canvas = canvasRef.current;
    if (video === null || canvas === null) return undefined;
    const feed = new MirrorFeed(screenId, video, canvas);
    const stopFollowing = followMinimized(value => feed.setMinimized(value));
    return () => {
      stopFollowing();
      feed.dispose();
    };
  }, [screenId, targetKind]);
  const bounds = pictureBounds(cropSize);
  return (
    <div className={styles.mirror}>
      <video ref={ref} className={styles.surface} muted playsInline />
      <canvas
        ref={canvasRef}
        className={styles.surface}
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        style={
          cropSize === undefined
            ? undefined
            : {
                position: 'absolute',
                width: `${(THEME_CANVAS.width / bounds.width) * 100}%`,
                height: `${(THEME_CANVAS.height / bounds.height) * 100}%`,
                left: `${(-bounds.x / bounds.width) * 100}%`,
                top: `${(-bounds.y / bounds.height) * 100}%`,
              }
        }
        hidden
      />
    </div>
  );
}
