import {useEffect, useRef, type JSX} from 'react';
import {
  isHiddenWorkspace,
  workspaceFrame,
} from '@renderer/ui/workspaceVisibility';
import styles from './OutputMirror.module.css';

/** A stream of the actual output web contents; no second picture renderer. */
export function OutputMirror({
  screenId,
  targetKind,
}: {
  readonly screenId: string;
  readonly targetKind?: string | undefined;
}): JSX.Element {
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
    let nativeActive = false;
    const stop = (): void => {
      generation++;
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
        if (source === 'alpha') return;
        if (source === null || source === undefined) {
          throw Error('Output unavailable');
        }
        const constraints: MediaTrackConstraints & {
          mandatory: {
            chromeMediaSource: string;
            chromeMediaSourceId: string;
            maxFrameRate: number;
          };
        } = {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: source,
            maxFrameRate: 20,
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
      window.llp?.output.previewControl({screenId, action: 'stop'});
      nativeActive = false;
      canvas.hidden = true;
      video.hidden = false;
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
  }, [screenId, targetKind]);
  return (
    <div className={styles.mirror}>
      <video ref={ref} className={styles.surface} muted playsInline />
      <canvas
        ref={canvasRef}
        className={styles.surface}
        width={640}
        height={360}
        hidden
      />
    </div>
  );
}
