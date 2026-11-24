/** The size of a preview picture, as main sends it and the relay sends it back. */
export const PREVIEW_WIDTH = 640;
/** The height, in pixels, of a preview picture. */
export const PREVIEW_HEIGHT = 360;
/** How often a captured picture goes back to main for the others. */
const RELAY_INTERVAL_MS = 100;
/** How long a failed capture waits before it tries again. */
const RETRY_MS = 1000;
/** The frame rate of the tab capture, enough for a preview. */
const CAPTURE_FPS = 10;

type OutputApi = NonNullable<typeof window.llp>['output'];

/**
 * Feeds the picture of one output into its 미리보기. Main sends ready pictures
 * of the output when it can (native frames); otherwise the preview captures
 * the output's page itself and, when main asks, relays that picture back for
 * the other previews. The last picture stays on the canvas while the feed
 * changes, and nothing runs while the window is minimized.
 */
export class MirrorFeed {
  private stopped = false;
  private minimized = true;
  /** Counts the captures, so an older one that comes in late is dropped. */
  private generation = 0;
  private stream: MediaStream | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private unsubscribeFrames: (() => void) | undefined;
  private unsubscribeRelay: (() => void) | undefined;
  private relayEnabled = false;
  private relayFrame: number | undefined;
  private relayDue = 0;
  private relayCanvas: HTMLCanvasElement | undefined;
  /** Main sends native frames now. */
  private nativeActive = false;
  /** The canvas holds a picture worth showing until a new one comes. */
  private retainedFrame = false;
  private videoFrame: number | undefined;

  constructor(
    private readonly screenId: string,
    private readonly video: HTMLVideoElement,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  /** Follows the window: a minimized window shows its last picture only. */
  setMinimized(value: boolean): void {
    if (this.stopped || this.minimized === value) return;
    this.minimized = value;
    if (value) {
      this.retainVideo();
      this.stopCapture();
      this.stopNative();
    } else {
      this.startNative();
      this.startCapture().catch(() => undefined);
    }
  }

  // NOTE(0913vision): Read through a call, so a check after an await sees the
  // window as it is then, not as it was before the await.
  private isMinimized(): boolean {
    return this.minimized;
  }

  dispose(): void {
    this.stopped = true;
    this.stopNative();
    this.stopCapture();
  }

  private readonly showVideo = (): void => {
    this.videoFrame = undefined;
    if (this.stopped || this.nativeActive || this.minimized) return;
    this.canvas.hidden = true;
    this.video.hidden = false;
  };

  /** Keeps the video's last picture on the canvas while it stops. */
  private retainVideo(): void {
    const {video, canvas} = this;
    if (video.hidden || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }
    try {
      const context = canvas.getContext('2d');
      if (context === null) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      this.retainedFrame = true;
      canvas.hidden = false;
      video.hidden = true;
    } catch {
      // NOTE(0913vision): Capture can end between the size check and draw.
    }
  }

  private stopRelay(): void {
    if (this.relayFrame !== undefined) {
      this.video.cancelVideoFrameCallback(this.relayFrame);
    }
    this.relayFrame = undefined;
  }

  /** Sends the captured picture to main, at most every RELAY_INTERVAL_MS. */
  private readonly relay = (now: number): void => {
    this.relayFrame = undefined;
    const {video} = this;
    if (!this.relayEnabled || !this.stream || this.stopped || this.minimized) {
      return;
    }
    if (now >= this.relayDue && video.videoWidth > 0 && video.videoHeight > 0) {
      this.relayCanvas ??= this.newRelayCanvas();
      const context = this.relayCanvas.getContext('2d');
      if (context !== null) {
        const scale = Math.min(
          PREVIEW_WIDTH / video.videoWidth,
          PREVIEW_HEIGHT / video.videoHeight,
        );
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;
        context.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
        context.drawImage(
          video,
          (PREVIEW_WIDTH - width) / 2,
          (PREVIEW_HEIGHT - height) / 2,
          width,
          height,
        );
        const image = context.getImageData(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
        window.llp?.output.publishPreview({
          screenId: this.screenId,
          frame: new Uint8Array(image.data),
        });
        this.relayDue = now + RELAY_INTERVAL_MS;
      }
    }
    this.relayFrame = video.requestVideoFrameCallback(this.relay);
  };

  private newRelayCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;
    return canvas;
  }

  private startRelay(): void {
    if (this.relayEnabled && this.stream && this.relayFrame === undefined) {
      this.relay(performance.now());
    }
  }

  /** Stops the tab capture and whatever waits on it. */
  private stopCapture(): void {
    this.generation++;
    this.stopRelay();
    if (this.videoFrame !== undefined) {
      this.video.cancelVideoFrameCallback(this.videoFrame);
      this.videoFrame = undefined;
    }
    if (this.retry !== undefined) clearTimeout(this.retry);
    this.retry = undefined;
    this.stream?.getTracks().forEach(track => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    this.video.srcObject = null;
  }

  /**
   * Captures the output's page, unless main sends its pictures another way.
   * A failed capture tries again after RETRY_MS.
   */
  private async startCapture(): Promise<void> {
    if (this.stopped || this.nativeActive || this.minimized) return;
    const own = ++this.generation;
    try {
      const source = await window.llp?.output.previewSource(this.screenId);
      if (source === 'alpha' || source === 'relay') return;
      if (source === null || source === undefined) {
        throw Error('Output unavailable');
      }
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: captureOf(source),
      });
      if (own !== this.generation || this.isMinimized()) {
        next.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = next;
      this.video.srcObject = next;
      next.getVideoTracks().forEach(track => {
        track.onended = () => {
          this.stopCapture();
          this.startCapture().catch(() => undefined);
        };
      });
      await this.video.play();
      if (
        this.retainedFrame &&
        typeof this.video.requestVideoFrameCallback === 'function'
      ) {
        this.videoFrame = this.video.requestVideoFrameCallback(() => {
          if (own === this.generation) this.showVideo();
        });
      }
      this.startRelay();
    } catch {
      if (own === this.generation && !this.isMinimized()) {
        this.stopCapture();
        this.retry = setTimeout(() => {
          this.startCapture().catch(() => undefined);
        }, RETRY_MS);
      }
    }
  }

  /** Takes the pictures main sends, and main's asks to relay ours. */
  private startNative(): void {
    const output = window.llp?.output;
    if (output === undefined || this.unsubscribeFrames !== undefined) return;
    this.unsubscribeRelay = output.subscribePreviewRelay(value => {
      if (value.screenId !== this.screenId) return;
      this.relayEnabled = value.enabled;
      if (this.relayEnabled) this.startRelay();
      else this.stopRelay();
    });
    this.unsubscribeFrames = output.subscribePreviewFrame(
      ({screenId, frame}) => {
        if (screenId !== this.screenId) return;
        if (frame === null) this.nativeEnded();
        else this.drawNative(output, frame);
      },
    );
    output.previewControl({screenId: this.screenId, action: 'start'});
  }

  /** Main stopped sending pictures: the capture takes over. */
  private nativeEnded(): void {
    this.nativeActive = false;
    if (!this.retainedFrame) {
      this.canvas.hidden = true;
      this.video.hidden = false;
    }
    this.startCapture().catch(() => undefined);
  }

  /** Draws a picture main sent, and tells main it may send the next. */
  private drawNative(output: OutputApi, pixels: Uint8Array): void {
    try {
      if (this.stopped || this.minimized) return;
      const context = this.canvas.getContext('2d');
      if (context === null) return;
      const bytes =
        pixels.buffer instanceof ArrayBuffer
          ? new Uint8ClampedArray(
              pixels.buffer,
              pixels.byteOffset,
              pixels.byteLength,
            )
          : Uint8ClampedArray.from(pixels);
      context.putImageData(
        new ImageData(bytes, PREVIEW_WIDTH, PREVIEW_HEIGHT),
        0,
        0,
      );
      this.retainedFrame = true;
      if (!this.nativeActive) {
        this.nativeActive = true;
        this.stopCapture();
        this.canvas.hidden = false;
        this.video.hidden = true;
      }
    } finally {
      output.previewControl({screenId: this.screenId, action: 'ack'});
    }
  }

  private stopNative(): void {
    this.unsubscribeFrames?.();
    this.unsubscribeFrames = undefined;
    this.unsubscribeRelay?.();
    this.unsubscribeRelay = undefined;
    this.relayEnabled = false;
    this.stopRelay();
    window.llp?.output.previewControl({
      screenId: this.screenId,
      action: 'stop',
    });
    this.nativeActive = false;
    if (!this.retainedFrame) {
      this.canvas.hidden = true;
      this.video.hidden = false;
    }
  }
}

/** The constraints that capture an output's page by its source id. */
function captureOf(source: string): MediaTrackConstraints {
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
      maxFrameRate: CAPTURE_FPS,
      maxWidth: PREVIEW_WIDTH,
      maxHeight: PREVIEW_HEIGHT,
    },
  };
  return constraints;
}
