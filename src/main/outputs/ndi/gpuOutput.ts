import type {OutputScreenStatus} from '@core/schema/live/outputStatus';
import type {Logger} from '../../base/log';
import type {OutputScreen} from '../screens';
import type {BitmapSender} from './output';
import type {OutputWindowEvents, OutputWindowHandle} from '../outputWindow';
import {createGpuSender} from './gpuSender';
import {forwardingHandle} from './forwardingHandle';
import {NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT} from './textureQueue';

interface Options {
  log: Logger;
  onFailure: (id: string, missing: boolean) => void;
  onGpuFallback?: () => void;
  onAcceleration?: (
    status: Pick<
      OutputScreenStatus,
      'ndiAcceleration' | 'ndiAccelerationReason'
    >,
  ) => void;
}

const RETRY_DELAYS_MS = [5000, 15_000, 60_000, 120_000] as const;

/** Keeps bitmap output live while checking whether shared textures have recovered. */
export function createGpuOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  {options, bitmap}: {options: Options; bitmap: () => BitmapSender},
): OutputWindowHandle {
  let active = false;
  let closed = false;
  let current = screen;
  let mode: 'gpu' | 'bitmap' = 'gpu';
  let retryIndex = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let probe: OutputWindowHandle | null = null;
  let sink: BitmapSender | null = null;
  let capture = {x: 0, y: 0, width: NDI_FRAME_WIDTH, height: NDI_FRAME_HEIGHT};
  let delegate: OutputWindowHandle;
  const clearTimers = (): void => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  };
  const scheduleProbe = (): void => {
    if (
      !active ||
      closed ||
      mode !== 'bitmap' ||
      retryTimer !== null ||
      probe !== null
    ) {
      return;
    }
    const delay =
      RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)] ??
      120_000;
    retryIndex++;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!active || closed || mode !== 'bitmap') return;
      options.log.info('retrying NDI hardware acceleration');
      const candidate = makeGpu(true);
      probe = candidate;
      candidate.showCapture(capture);
    }, delay);
  };
  const enterBitmap = (reason: unknown): void => {
    if (mode === 'bitmap' || closed || !active) return;
    mode = 'bitmap';
    options.onAcceleration?.({
      ndiAcceleration: 'bitmap',
      ndiAccelerationReason: accelerationReason(reason),
    });
    options.log.warn(
      'NDI shared texture unavailable; using bitmap output',
      reason,
    );
    delegate.destroy();
    sink ??= bitmap();
    sink.setGpuInput(false);
    delegate = sink;
    delegate.configure(current);
    delegate.showCapture(capture);
    retryIndex = 0;
    scheduleProbe();
  };
  const makeGpu = (background: boolean): OutputWindowHandle => {
    let isProbe = background;
    const failed = (reason: unknown): void => {
      if (closed || !active) return;
      if (isProbe) {
        if (probe !== candidate) return;
        probe = null;
        sink?.setGpuInput(false);
        candidate.destroy();
        scheduleProbe();
        return;
      }
      if (delegate !== candidate || mode !== 'gpu') return;
      enterBitmap(reason);
    };
    const promote = (): void => {
      if (
        !isProbe ||
        probe !== candidate ||
        !active ||
        mode !== 'bitmap' ||
        closed
      ) {
        return;
      }
      probe = null;
      isProbe = false;
      delegate = candidate;
      mode = 'gpu';
      candidate.activateMirror();
      options.onAcceleration?.({ndiAcceleration: 'hardware'});
      clearTimers();
    };
    const candidate = createGpuSender(
      current,
      background
        ? {
            ...events,
            onRendererGone: details => {
              if (isProbe) failed(details);
              else events.onRendererGone(details);
            },
          }
        : events,
      {
        log: options.log,
        fallback: failed,
        runtimeMissing: () => {
          if (isProbe) failed('NDI runtime missing');
          else options.onFailure(current.id, true);
        },
        live: () => {
          if (!background && delegate === candidate) {
            options.onAcceleration?.({ndiAcceleration: 'hardware'});
          }
        },
        ...(background
          ? {
              pixels: (data: Uint8Array, release: () => void) => {
                if (
                  !sink ||
                  !active ||
                  closed ||
                  (isProbe ? probe !== candidate : delegate !== candidate)
                ) {
                  release();
                  return;
                }
                sink.setGpuInput(true);
                sink.submitGpuPixels(data, () => {
                  release();
                  promote();
                });
              },
            }
          : {}),
      },
    );
    return candidate;
  };
  delegate = makeGpu(false);
  return {
    ...forwardingHandle(() => delegate),
    configure: next => {
      current = next;
      delegate.configure(next);
      if (sink && sink !== delegate) sink.configure(next);
      probe?.configure(next);
    },
    showFullScreen: (bounds, top) => {
      active = true;
      delegate.showFullScreen(bounds, top);
    },
    showWindowed: (bounds, top) => {
      active = true;
      delegate.showWindowed(bounds, top);
    },
    showCapture: (bounds, top) => {
      if (!active && mode !== 'bitmap') {
        options.onAcceleration?.({ndiAcceleration: 'pending'});
      }
      active = true;
      capture = bounds;
      if (sink && sink !== delegate) sink.showCapture(bounds, top);
      delegate.showCapture(bounds, top);
      if (mode === 'bitmap') scheduleProbe();
    },
    hide: () => {
      active = false;
      clearTimers();
      probe?.destroy();
      probe = null;
      sink?.setGpuInput(false);
      if (sink && sink !== delegate) sink.hide();
      delegate.hide();
    },
    destroy: () => {
      active = false;
      closed = true;
      clearTimers();
      probe?.destroy();
      probe = null;
      if (sink && sink !== delegate) sink.destroy();
      delegate.destroy();
    },
  };
}

/** Why the GPU path stopped, as the 화면 설정 status names it. */
function accelerationReason(
  reason: unknown,
): NonNullable<OutputScreenStatus['ndiAccelerationReason']> {
  if (
    reason === 'no shared texture paint' ||
    reason === 'shared textures stopped arriving'
  ) {
    return 'no-texture';
  }
  return reason === 'GPU compositing is unavailable' ? 'compositor' : 'error';
}
