import {useEffect, useRef, useState, type JSX, type ReactNode} from 'react';
import {
  isHiddenWorkspace,
  workspaceFrame,
} from '@renderer/ui/workspaceVisibility';
import styles from './OutputMirror.module.css';
import {pictureBounds} from '@renderer/rendering/pictures/drawPicture';

/** A stream of the actual output web contents; no second picture renderer. */
export function OutputMirror({
  screenId,
  targetKind,
  cropSize,
  fallback,
}: {
  readonly screenId: string;
  readonly fallback?: ReactNode;
  readonly targetKind?: string | undefined;
  readonly cropSize?:
    {readonly width: number; readonly height: number} | undefined;
}): JSX.Element {
  const [readyScreen, setReadyScreen] = useState<string>();
  const hasFallback = fallback !== undefined;
  const ref = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const video = ref.current;
    const canvas = canvasRef.current;
    if (video === null || canvas === null) return undefined;
    const frame = workspaceFrame(video);
    let generation = 0;
    const lifetime = {stopped: false};
    let stream: MediaStream | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    let unsubscribeRelay: (() => void) | undefined;
    let relayEnabled = false;
    let relayFrame: number | undefined;
    let relayDue = 0;
    let relayCanvas: HTMLCanvasElement | undefined;
    let nativeActive = false;
    let hasFrame = false;
    let nextVideoFrame: number | undefined;
    const retainVideoFrame = (): void => {
      if (nativeActive || stream === null) return;
      const restoreFallback = (): void => {
        if (!hasFrame && hasFallback && !lifetime.stopped) {
          video.hidden = true;
          setReadyScreen(undefined);
        }
      };
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        restoreFallback();
        return;
      }
      try {
        const context = canvas.getContext('2d');
        if (context === null) {
          restoreFallback();
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        hasFrame = true;
        canvas.hidden = false;
        video.hidden = true;
      } catch {
        restoreFallback();
      }
    };
    const stopRelay = (): void => {
      if (relayFrame !== undefined) video.cancelVideoFrameCallback(relayFrame);
      relayFrame = undefined;
    };
    const relay = (now: number): void => {
      relayFrame = undefined;
      if (
        !relayEnabled ||
        !stream ||
        lifetime.stopped ||
        isHiddenWorkspace(frame)
      ) {
        return;
      }
      if (now >= relayDue && video.videoWidth > 0 && video.videoHeight > 0) {
        if (relayCanvas === undefined) {
          relayCanvas = document.createElement('canvas');
          relayCanvas.width = 640;
          relayCanvas.height = 360;
        }
        const context = relayCanvas.getContext('2d');
        if (context !== null) {
          const scale = Math.min(
            640 / video.videoWidth,
            360 / video.videoHeight,
          );
          const width = video.videoWidth * scale;
          const height = video.videoHeight * scale;
          context.clearRect(0, 0, 640, 360);
          context.drawImage(
            video,
            (640 - width) / 2,
            (360 - height) / 2,
            width,
            height,
          );
          const image = context.getImageData(0, 0, 640, 360);
          window.llp?.output.publishPreview({
            screenId,
            frame: new Uint8Array(image.data),
          });
          relayDue = now + 100;
        }
      }
      relayFrame = video.requestVideoFrameCallback(relay);
    };
    const startRelay = (): void => {
      if (relayEnabled && stream && relayFrame === undefined) {
        relay(performance.now());
      }
    };
    const stop = (): void => {
      generation++;
      if (nextVideoFrame !== undefined) {
        video.cancelVideoFrameCallback(nextVideoFrame);
      }
      nextVideoFrame = undefined;
      retainVideoFrame();
      stopRelay();
      if (retry !== undefined) clearTimeout(retry);
      retry = undefined;
      stream?.getTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
      stream = null;
      video.srcObject = null;
    };
    const start = async (): Promise<void> => {
      if (lifetime.stopped || nativeActive || isHiddenWorkspace(frame)) return;
      const own = ++generation;
      try {
        const source = await window.llp?.output.previewSource(screenId);
        if (source === 'alpha' || source === 'relay') return;
        if (source === null || source === undefined) {
          throw Error('Output unavailable');
        }
        const constraints: MediaTrackConstraints & {
          mandatory: {
            chromeMediaSource: string;
            chromeMediaSourceId: string;
            maxFrameRate: number;
            maxWidth: number;
            maxHeight: number;
          };
        } = {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: source,
            maxFrameRate: 10,
            maxWidth: 640,
            maxHeight: 360,
          },
        };
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: constraints,
        });
        if (own !== generation || isHiddenWorkspace(frame)) {
          next.getTracks().forEach(track => track.stop());
          return;
        }
        stream = next;
        video.srcObject = next;
        next.getVideoTracks().forEach(track => {
          track.onended = () => {
            stop();
            start().catch(() => undefined);
          };
        });
        await video.play();
        if (own !== generation) return;
        if (hasFrame || hasFallback) {
          nextVideoFrame = video.requestVideoFrameCallback(() => {
            nextVideoFrame = undefined;
            if (own !== generation || lifetime.stopped) return;
            canvas.hidden = true;
            video.hidden = false;
            setReadyScreen(screenId);
          });
        } else {
          canvas.hidden = true;
          video.hidden = false;
        }
        startRelay();
      } catch {
        if (own === generation && !isHiddenWorkspace(frame)) {
          stop();
          retry = setTimeout(() => {
            start().catch(() => undefined);
          }, 1000);
        }
      }
    };
    const startNative = (): void => {
      const output = window.llp?.output;
      if (output === undefined || unsubscribe !== undefined) return;
      unsubscribeRelay = output.subscribePreviewRelay(value => {
        if (value.screenId !== screenId) return;
        relayEnabled = value.enabled;
        if (relayEnabled) startRelay();
        else stopRelay();
      });
      unsubscribe = output.subscribePreviewFrame(
        ({screenId: id, frame: pixels}) => {
          if (id !== screenId) return;
          if (pixels === null) {
            nativeActive = false;
            start().catch(() => undefined);
            return;
          }
          try {
            if (lifetime.stopped || isHiddenWorkspace(frame)) return;
            const context = canvas.getContext('2d');
            if (context === null) return;
            const bytes =
              pixels.buffer instanceof ArrayBuffer
                ? new Uint8ClampedArray(
                    pixels.buffer,
                    pixels.byteOffset,
                    pixels.byteLength,
                  )
                : Uint8ClampedArray.from(pixels);
            context.putImageData(new ImageData(bytes, 640, 360), 0, 0);
            hasFrame = true;
            setReadyScreen(screenId);
            if (!nativeActive) {
              nativeActive = true;
              stop();
              canvas.hidden = false;
              video.hidden = true;
            }
          } finally {
            output.previewControl({screenId, action: 'ack'});
          }
        },
      );
      output.previewControl({screenId, action: 'start'});
    };
    const stopNative = (): void => {
      unsubscribe?.();
      unsubscribe = undefined;
      unsubscribeRelay?.();
      unsubscribeRelay = undefined;
      relayEnabled = false;
      stopRelay();
      window.llp?.output.previewControl({screenId, action: 'stop'});
      nativeActive = false;
    };
    const observer = new MutationObserver(() => {
      stop();
      stopNative();
      if (!isHiddenWorkspace(frame)) {
        startNative();
        start().catch(() => undefined);
      }
    });
    if (frame !== null) {
      observer.observe(frame, {
        attributes: true,
        attributeFilter: ['aria-hidden'],
      });
    }
    if (!isHiddenWorkspace(frame)) {
      startNative();
      start().catch(() => undefined);
    }
    return () => {
      lifetime.stopped = true;
      observer.disconnect();
      stopNative();
      stop();
    };
  }, [screenId, targetKind, hasFallback]);
  const bounds = pictureBounds(cropSize);
  return (
    <div className={styles.mirror}>
      {hasFallback && readyScreen !== screenId ? (
        <div className={styles.fallback}>{fallback}</div>
      ) : null}
      <video
        ref={ref}
        className={styles.surface}
        muted
        playsInline
        hidden={hasFallback}
      />
      <canvas
        ref={canvasRef}
        className={styles.surface}
        width={640}
        height={360}
        style={
          cropSize === undefined
            ? undefined
            : {
                position: 'absolute',
                width: `${(1920 / bounds.width) * 100}%`,
                height: `${(1080 / bounds.height) * 100}%`,
                left: `${(-bounds.x / bounds.width) * 100}%`,
                top: `${(-bounds.y / bounds.height) * 100}%`,
              }
        }
        hidden
      />
    </div>
  );
}
