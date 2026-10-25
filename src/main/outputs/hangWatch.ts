/**
 * How long a visible output may go without a frame rate report before the
 * main process asks whether its page still answers. Reports come once a
 * second.
 */
export const FRAME_SILENCE_MS = 5000;

/**
 * How long a silent page has to answer before its renderer counts as hung. A
 * busy page (a heavy video decode, a long garbage collection) answers well
 * within it; only a stuck main thread doesn't.
 */
export const ANSWER_LIMIT_MS = 10_000;

/** What a {@link HangWatch} asks and tells. */
export interface HangWatchOptions {
  /** Asks the page's main thread for an answer; resolves when it answers. */
  readonly ping: () => Promise<void>;
  /** The page went silent and didn't answer within {@link ANSWER_LIMIT_MS}. */
  readonly onHung: () => void;
  /** The page answers but sends no frame rate reports, once per silent stretch. */
  readonly onSilentButAnswering: () => void;
}

/**
 * Notices a renderer that stopped working without dying. Each beat (a frame
 * rate report) starts the silence countdown over. When it runs out, the watch
 * pings the page: no answer within the limit means hung; an answer means the
 * page is alive but not drawing, which is reported, and the watch checks again
 * after the next silence. Output windows get no input, so Electron's own
 * `unresponsive` event, which Chromium raises from its input hang monitor,
 * may never fire for them.
 */
export class HangWatch {
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private answerTimer: ReturnType<typeof setTimeout> | null = null;
  private question = 0;
  private silenceReported = false;

  constructor(private readonly options: HangWatchOptions) {}

  /** A sign of life: the countdown starts over. */
  beat(): void {
    this.stop();
    this.silenceReported = false;
    this.waitForSilence();
  }

  stop(): void {
    this.question += 1;
    this.clearSilence();
    this.clearAnswer();
  }

  private waitForSilence(): void {
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      this.ask();
    }, FRAME_SILENCE_MS);
  }

  private ask(): void {
    this.question += 1;
    const asked = this.question;
    this.answerTimer = setTimeout(() => {
      this.answerTimer = null;
      this.question += 1;
      this.options.onHung();
    }, ANSWER_LIMIT_MS);
    // NOTE(0913vision): A ping that fails (the page is gone or loading) counts
    // as no answer, and the answer limit decides.
    this.options.ping().then(
      () => {
        if (asked === this.question) this.answered();
      },
      () => undefined,
    );
  }

  private answered(): void {
    this.clearAnswer();
    if (!this.silenceReported) {
      this.silenceReported = true;
      this.options.onSilentButAnswering();
    }
    this.waitForSilence();
  }

  private clearSilence(): void {
    if (this.silenceTimer === null) return;
    clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  private clearAnswer(): void {
    if (this.answerTimer === null) return;
    clearTimeout(this.answerTimer);
    this.answerTimer = null;
  }
}
