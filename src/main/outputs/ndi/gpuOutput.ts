import type {OutputScreenStatus} from '@core/schema/live/outputStatus';
import type {Logger} from '../../base/log';
import type {Rect} from '../../displays/rect';
import type {OutputScreen} from '../screens';
import type {BitmapSender} from './bitmapOutput';
import type {OutputWindowEvents, OutputWindowHandle} from '../outputWindow';
import {createGpuSender, type GpuSender} from './gpuSender';
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

/**
 * One shared texture sender: the one that sends the screen, or a probe that
 * checks in the background whether shared textures work again. A probe that
 * proves itself becomes the one that sends.
 */
interface GpuSending {
  readonly sender: GpuSender;
  /** Made as a probe, behind the bitmap output. */
  readonly background: boolean;
  probing: boolean;
}

/** Keeps bitmap output live while checking whether shared textures have recovered. */
export function createGpuOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  {options, bitmap}: {options: Options; bitmap: () => BitmapSender},
): OutputWindowHandle {
  return new GpuOutput(screen, events, {options, bitmap}).handle();
}

/**
 * The waits before each new probe after the GPU path stopped, longer each
 * time, and the probe timer waiting now.
 */
class ProbeSchedule {
  private tries = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  get waiting(): boolean {
    return this.timer !== null;
  }

  /** Starts the next wait; `run` is called when it ends. */
  wait(run: () => void): void {
    const delay =
      RETRY_DELAYS_MS[Math.min(this.tries, RETRY_DELAYS_MS.length - 1)] ??
      120_000;
    this.tries += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      run();
    }, delay);
  }

  /** Stops the wait on its way, keeping how many came before. */
  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** The next wait is the first and shortest again. */
  restart(): void {
    this.tries = 0;
  }
}

/**
 * An NDI screen sent through shared textures (`gpu`) and, while they fail,
 * through the bitmap output (`bitmap`), with probes in the background that
 * bring the shared textures back once one of their frames went out.
 */
class GpuOutput {
  /** Shown since the last hide: probes and fallbacks happen only then. */
  private shown = false;
  private closed = false;
  private mode: 'gpu' | 'bitmap' = 'gpu';
  private capture: Rect = {
    x: 0,
    y: 0,
    width: NDI_FRAME_WIDTH,
    height: NDI_FRAME_HEIGHT,
  };
  /** The bitmap output, made at the first fallback and kept from then on. */
  private sink: BitmapSender | null = null;
  private probe: GpuSending | null = null;
  /** What sends the screen now: a shared texture sender, or the bitmap output. */
  private sending: OutputWindowHandle;
  private readonly probes = new ProbeSchedule();

  private readonly options: Options;
  private readonly bitmap: () => BitmapSender;

  constructor(
    private screen: OutputScreen,
    private readonly events: OutputWindowEvents,
    {options, bitmap}: {options: Options; bitmap: () => BitmapSender},
  ) {
    this.options = options;
    this.bitmap = bitmap;
    this.sending = this.startSender(false).sender;
  }

  handle(): OutputWindowHandle {
    return {
      ...forwardingHandle(() => this.sending),
      configure: next => {
        this.screen = next;
        this.sending.configure(next);
        this.otherSink()?.configure(next);
        this.probe?.sender.configure(next);
      },
      showFullScreen: (bounds, top) => {
        this.shown = true;
        this.sending.showFullScreen(bounds, top);
      },
      showWindowed: (bounds, top) => {
        this.shown = true;
        this.sending.showWindowed(bounds, top);
      },
      showCapture: (bounds, top) => {
        if (!this.shown && this.mode !== 'bitmap') {
          this.options.onAcceleration?.({ndiAcceleration: 'pending'});
        }
        this.shown = true;
        this.capture = bounds;
        this.otherSink()?.showCapture(bounds, top);
        this.sending.showCapture(bounds, top);
        if (this.mode === 'bitmap') this.scheduleProbe();
      },
      hide: () => {
        this.shown = false;
        this.dropProbe();
        this.sink?.setGpuInput(false);
        this.otherSink()?.hide();
        this.sending.hide();
      },
      destroy: () => {
        this.shown = false;
        this.closed = true;
        this.dropProbe();
        this.otherSink()?.destroy();
        this.sending.destroy();
      },
    };
  }

  /** The bitmap output when it exists but doesn't send the screen now. */
  private otherSink(): BitmapSender | null {
    return this.sink !== null && this.sink !== this.sending ? this.sink : null;
  }

  private get running(): boolean {
    return this.shown && !this.closed;
  }

  private dropProbe(): void {
    this.probes.cancel();
    this.probe?.sender.destroy();
    this.probe = null;
  }

  private scheduleProbe(): void {
    if (
      !this.running ||
      this.mode !== 'bitmap' ||
      this.probes.waiting ||
      this.probe !== null
    ) {
      return;
    }
    this.probes.wait(() => {
      if (!this.running || this.mode !== 'bitmap') return;
      this.options.log.info('retrying NDI hardware acceleration');
      this.probe = this.startSender(true);
      this.probe.sender.showCapture(this.capture);
    });
  }

  private enterBitmap(reason: unknown): void {
    if (this.mode === 'bitmap' || !this.running) return;
    this.mode = 'bitmap';
    this.options.onAcceleration?.({
      ndiAcceleration: 'bitmap',
      ndiAccelerationReason: accelerationReason(reason),
    });
    this.options.log.warn(
      'NDI shared texture unavailable; using bitmap output',
      reason,
    );
    this.sending.destroy();
    this.sink ??= this.bitmap();
    this.sink.setGpuInput(false);
    this.sending = this.sink;
    this.sending.configure(this.screen);
    this.sending.showCapture(this.capture);
    this.probes.restart();
    this.scheduleProbe();
  }

  private failed(sending: GpuSending, reason: unknown): void {
    if (!this.running) return;
    if (sending.probing) {
      if (this.probe !== sending) return;
      this.probe = null;
      this.sink?.setGpuInput(false);
      sending.sender.destroy();
      this.scheduleProbe();
      return;
    }
    if (this.sending !== sending.sender || this.mode !== 'gpu') return;
    this.enterBitmap(reason);
  }

  /** A probe's frame went out: shared textures work again, and it sends. */
  private promote(sending: GpuSending): void {
    if (
      !sending.probing ||
      this.probe !== sending ||
      !this.running ||
      this.mode !== 'bitmap'
    ) {
      return;
    }
    this.probe = null;
    sending.probing = false;
    this.sending = sending.sender;
    this.mode = 'gpu';
    sending.sender.activateMirror();
    this.options.onAcceleration?.({ndiAcceleration: 'hardware'});
    this.probes.cancel();
  }

  /** Whether a sender is the one its frames belong to now. */
  private current(sending: GpuSending): boolean {
    return sending.probing
      ? this.probe === sending
      : this.sending === sending.sender;
  }

  private startSender(background: boolean): GpuSending {
    const sender = createGpuSender(
      this.screen,
      background
        ? {
            ...this.events,
            onRendererGone: details => {
              if (sending.probing) this.failed(sending, details);
              else this.events.onRendererGone(details);
            },
          }
        : this.events,
      {
        log: this.options.log,
        fallback: reason => this.failed(sending, reason),
        runtimeMissing: () => {
          if (sending.probing) this.failed(sending, 'NDI runtime missing');
          else this.options.onFailure(this.screen.id, true);
        },
        live: () => {
          if (!background && this.sending === sending.sender) {
            this.options.onAcceleration?.({ndiAcceleration: 'hardware'});
          }
        },
        ...(background
          ? {
              pixels: (data: Uint8Array, release: () => void) => {
                const sink = this.sink;
                if (sink === null || !this.running || !this.current(sending)) {
                  release();
                  return;
                }
                sink.setGpuInput(true);
                sink.submitGpuPixels(data, sent => {
                  release();
                  if (sent) this.promote(sending);
                });
              },
            }
          : {}),
      },
    );
    // NOTE(0913vision): The sender's callbacks come only after it is made, so
    // they find the record it belongs to.
    const sending: GpuSending = {sender, background, probing: background};
    return sending;
  }
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
