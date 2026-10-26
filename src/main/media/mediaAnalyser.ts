import type {PixelSize} from '@shared/coverCrop';
import {MEDIA_LIMITS} from '@shared/schema/mediaList';
import {
  THUMBNAIL_DATA_URL_PREFIX,
  parseAnalysisReply,
  type AnalysisFailureReason,
  type AnalysisJob,
  type AnalysisReply,
} from '@shared/schema/mediaAnalysis';
import type {Logger} from '../log';
import type {AnalysisFiles} from './analysisFiles';
import type {MediaKind} from './mediaKinds';

/** How many files may wait for analysis; one import batch. */
export const MAX_QUEUED_ANALYSES = MEDIA_LIMITS.importBatch;

/** How long one file may take before the analysis page is closed. */
export const ANALYSIS_TIMEOUT_MS = 20_000;

/** How long the analysis page stays open with nothing to read. */
export const ANALYSIS_IDLE_CLOSE_MS = 30_000;

/** The thumbnail size: the 16:9 tile frame, twice its usual width. */
export const THUMBNAIL_SIZE: PixelSize = {width: 320, height: 180};

/** The hidden analysis page as main drives it. */
export interface AnalysisPage {
  /** Runs one job; the reply comes from a renderer and isn't checked yet. */
  run(job: AnalysisJob): Promise<unknown>;
  close(): void;
}

/** What analysis found out about a media file. */
export interface MediaFacts {
  readonly duration?: number;
  readonly width?: number;
  readonly height?: number;
  /** A JPEG at {@link THUMBNAIL_SIZE}. */
  readonly thumbnail?: Buffer;
}

/**
 * How an analysis ended: the facts it read; `cant-play` when Chromium's
 * decoders refuse the file, so the output can't play it either; or
 * `unavailable` when the file couldn't be analysed, such as after a timeout.
 */
export type Analysis =
  | {readonly kind: 'read'; readonly facts: MediaFacts}
  | {
      readonly kind: 'cant-play';
      readonly reason: AnalysisFailureReason;
      readonly message: string;
    }
  | {readonly kind: 'unavailable'; readonly message: string};

/** One file to analyse. */
export interface AnalysisRequest {
  readonly file: string;
  readonly kind: MediaKind;
  readonly thumbnail: boolean;
  /** Stops waiting for the analysis; a running one still finishes in the page. */
  readonly signal?: AbortSignal;
}

/** The arguments of the {@link MediaAnalyser} constructor. */
export interface MediaAnalyserOptions {
  /**
   * Opens the analysis page. The signal aborts when analysis gives up on the
   * page, after a timeout, when idle, or on disposal, even while it loads.
   */
  readonly openPage: (signal: AbortSignal) => Promise<AnalysisPage>;
  readonly files: AnalysisFiles;
  /** Measures an image in main; null when it can't read it. */
  readonly measureImage: (
    file: string,
    thumbnail: PixelSize | null,
  ) => MediaFacts | null;
  readonly log: Logger;
  readonly timeoutMs?: number;
  readonly idleCloseMs?: number;
}

interface Waiting {
  readonly request: AnalysisRequest;
  readonly settle: (analysis: Analysis) => void;
}

const TIMED_OUT = Symbol('timed out');
const STOPPED = Symbol('stopped');

function unavailable(message: string): Analysis {
  return {kind: 'unavailable', message};
}

function analysisOf(reply: AnalysisReply): Analysis {
  if (!reply.ok) {
    return {kind: 'cant-play', reason: reply.reason, message: reply.message};
  }
  const {ok: _ok, thumbnail, ...measured} = reply;
  return {
    kind: 'read',
    facts: {
      ...measured,
      ...(thumbnail === undefined
        ? {}
        : {
            thumbnail: Buffer.from(
              thumbnail.slice(THUMBNAIL_DATA_URL_PREFIX.length),
              'base64',
            ),
          }),
    },
  };
}

/**
 * Analyses media files one at a time (`docs/decisions.md`, "Media analysis
 * runs in a hidden renderer"). Images that `nativeImage` reads are measured in
 * main; video, audio, and other images go to the hidden analysis page, which
 * opens on demand, gets {@link ANALYSIS_TIMEOUT_MS} per file, and closes after
 * {@link ANALYSIS_IDLE_CLOSE_MS} with nothing to read. At most
 * {@link MAX_QUEUED_ANALYSES} files wait.
 */
export class MediaAnalyser {
  private readonly queue: Waiting[] = [];
  private page: Promise<AnalysisPage> | null = null;
  private pageAbort: AbortController | null = null;
  private running: Waiting | null = null;
  // NOTE(0913vision): Aborted on disposal, so the running analysis stops
  // waiting, gives its file back, and never reaches a page opened later.
  private active: AbortController | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(private readonly options: MediaAnalyserOptions) {}

  /** Analyses one file. Never rejects. */
  analyse(request: AnalysisRequest): Promise<Analysis> {
    if (this.disposed) {
      return Promise.resolve(unavailable('Media analysis is closed'));
    }
    if (request.kind === 'image') {
      const measured = this.measure(request);
      if (measured !== null) {
        return Promise.resolve({kind: 'read', facts: measured});
      }
    }
    if (this.queue.length >= MAX_QUEUED_ANALYSES) {
      return Promise.resolve(unavailable('Too many files wait for analysis'));
    }
    return new Promise(resolve => {
      const {signal} = request;
      const stop = (): void => {
        const index = this.queue.indexOf(waiting);
        if (index >= 0) this.queue.splice(index, 1);
        waiting.settle(unavailable('The analysis was cancelled'));
      };
      const waiting: Waiting = {
        request,
        settle: analysis => {
          signal?.removeEventListener('abort', stop);
          resolve(analysis);
        },
      };
      if (signal?.aborted === true) {
        waiting.settle(unavailable('The analysis was cancelled'));
        return;
      }
      signal?.addEventListener('abort', stop, {once: true});
      this.queue.push(waiting);
      this.pump();
    });
  }

  /** Answers the running and waiting analyses and closes the page. */
  dispose(): void {
    this.disposed = true;
    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
    for (const waiting of [this.running, ...this.queue.splice(0)]) {
      waiting?.settle(unavailable('Media analysis is closed'));
    }
    this.active?.abort();
    this.closePage();
  }

  private measure(request: AnalysisRequest): MediaFacts | null {
    try {
      return this.options.measureImage(
        request.file,
        request.thumbnail ? THUMBNAIL_SIZE : null,
      );
    } catch (error: unknown) {
      this.options.log.warn('could not measure an image', {
        file: request.file,
        error,
      });
      return null;
    }
  }

  private pump(): void {
    if (this.running !== null || this.disposed) return;
    const next = this.queue.shift();
    if (next === undefined) {
      this.closeWhenIdle();
      return;
    }
    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
    this.running = next;
    const done = (analysis: Analysis): void => {
      next.settle(analysis);
      this.running = null;
      this.pump();
    };
    this.runOne(next.request).then(done, (error: unknown) => {
      this.options.log.error('media analysis failed', error);
      done(unavailable('The analysis failed'));
    });
  }

  private closeWhenIdle(): void {
    if (this.page === null || this.idleTimer !== undefined) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      this.closePage();
    }, this.options.idleCloseMs ?? ANALYSIS_IDLE_CLOSE_MS);
  }

  private async runOne(request: AnalysisRequest): Promise<Analysis> {
    const lent = this.options.files.lend(request.file);
    if (lent === null) return unavailable('Another file is lent for analysis');
    const active = new AbortController();
    this.active = active;
    try {
      const reply = await this.withDeadline(
        this.openAndRun(
          {
            url: lent.url,
            kind: request.kind,
            thumbnail: request.thumbnail ? THUMBNAIL_SIZE : null,
          },
          active.signal,
        ),
        active.signal,
      );
      if (reply === STOPPED) return unavailable('Media analysis is closed');
      if (reply === TIMED_OUT) {
        this.options.log.warn('media analysis timed out', {file: request.file});
        this.closePage();
        return unavailable('The analysis timed out');
      }
      const parsed = parseAnalysisReply(reply);
      if (parsed.ok) return analysisOf(parsed.value);
      this.options.log.warn('dropped a malformed analysis reply', parsed.error);
      return unavailable('The analysis page answered something else');
    } catch (error: unknown) {
      this.options.log.warn('media analysis failed', {
        file: request.file,
        error,
      });
      this.closePage();
      return unavailable('The analysis page failed');
    } finally {
      this.active = null;
      lent.release();
    }
  }

  private async openAndRun(
    job: AnalysisJob,
    signal: AbortSignal,
  ): Promise<unknown> {
    const page = await this.openedPage();
    return signal.aborted ? STOPPED : page.run(job);
  }

  private openedPage(): Promise<AnalysisPage> {
    if (this.page === null) {
      const abort = new AbortController();
      this.pageAbort = abort;
      this.page = this.options.openPage(abort.signal);
    }
    return this.page;
  }

  // NOTE(0913vision): One deadline for opening the page and running the job,
  // so a page that never opens can't hold the queue either; disposal ends it
  // at once.
  private async withDeadline(
    work: Promise<unknown>,
    signal: AbortSignal,
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: () => void = () => undefined;
    const onAbort = (): void => {
      stop();
    };
    const deadline = new Promise<typeof TIMED_OUT | typeof STOPPED>(resolve => {
      stop = () => {
        resolve(STOPPED);
      };
      timer = setTimeout(() => {
        resolve(TIMED_OUT);
      }, this.options.timeoutMs ?? ANALYSIS_TIMEOUT_MS);
    });
    if (signal.aborted) stop();
    signal.addEventListener('abort', onAbort, {once: true});
    try {
      return await Promise.race([work, deadline]);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }

  private closePage(): void {
    const page = this.page;
    this.page = null;
    this.pageAbort?.abort();
    this.pageAbort = null;
    page?.then(
      opened => {
        opened.close();
      },
      () => undefined,
    );
  }
}
