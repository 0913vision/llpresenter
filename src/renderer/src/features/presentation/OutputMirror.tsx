import {useEffect, useRef, type JSX} from 'react';
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
    const frame = workspaceFrame(video);
    const cell = video.closest('[data-screen]');
    const hidden = (): boolean =>
      isHiddenWorkspace(frame) || cell?.getAttribute('aria-hidden') === 'true';
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
    const stopRelay = (): void => {
      if (relayFrame !== undefined) video.cancelVideoFrameCallback(relayFrame);
      relayFrame = undefined;
    };
    const relay = (now: number): void => {
      relayFrame = undefined;
      if (!relayEnabled || !stream || lifetime.stopped || hidden()) {
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
      if (lifetime.stopped || nativeActive || hidden()) return;
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
            chromeMediaSource: source.startsWith('desktop:')
              ? 'desktop'
              : 'tab',
            chromeMediaSourceId: source.startsWith('desktop:')
              ? source.slice('desktop:'.length)
              : source,
            maxFrameRate: 10,
            maxWidth: 640,
            maxHeight: 360,
          },
        };
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: constraints,
        });
        if (own !== generation || hidden()) {
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
        startRelay();
      } catch {
        if (own === generation && !hidden()) {
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
            canvas.hidden = true;
            video.hidden = false;
            start().catch(() => undefined);
            return;
          }
          try {
            if (lifetime.stopped || hidden()) return;
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
      canvas.hidden = true;
      video.hidden = false;
    };
    const observer = new MutationObserver(() => {
      stop();
      stopNative();
      if (!hidden()) {
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
    if (cell !== null && cell !== frame) {
      observer.observe(cell, {
        attributes: true,
        attributeFilter: ['aria-hidden'],
      });
    }
    if (!hidden()) {
      startNative();
      start().catch(() => undefined);
    }
    return () => {
      lifetime.stopped = true;
      observer.disconnect();
      stopNative();
      stop();
    };
  }, [screenId, targetKind]);
  const bounds = pictureBounds(cropSize);
  return (
    <div className={styles.mirror}>
      <video ref={ref} className={styles.surface} muted playsInline />
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
