import {mediaEndpoints} from '@contracts/ipc/media';
import type {Result} from '@core/common/result';
import type {MediaId} from '@core/schema/common/ids';
import {
  parseMediaImportProgress,
  type MediaImportRequest,
} from '@core/schema/media/mediaEdit';
import type {PayloadError} from '@core/schema/common/payload';
import type {IpcHost} from '../../base/ipcHost';
import type {Logger} from '../../base/log';
import {mediaRefusal} from './mediaEdits';

/**
 * What copies, analyses, and finds media files. Disconnecting it, or closing
 * the media list, aborts the signal of its calls.
 */
export interface MediaBackend {
  import(request: MediaImportRequest, signal: AbortSignal): Promise<unknown>;
  relink(mediaId: MediaId, signal: AbortSignal): Promise<unknown>;
  cancel(mediaId: MediaId, signal: AbortSignal): Promise<unknown>;
}

/** Where the media backend connects. */
export interface MediaBackendPort {
  connect(backend: MediaBackend): MediaBackendConnection;
}

export interface MediaBackendConnection {
  /** Sends the progress of a copy to the windows once it passes its check. */
  report(progress: unknown): boolean;
  disconnect(): void;
}

/** One call of the backend, with the check of its answer. */
interface BackendCall<TReply> {
  /** What the call does, for the log. */
  readonly name: string;
  readonly run: (
    backend: MediaBackend,
    signal: AbortSignal,
  ) => Promise<unknown>;
  readonly parse: (value: unknown) => Result<TReply, PayloadError>;
}

interface ConnectedBackend {
  readonly backend: MediaBackend;
  readonly abort: AbortController;
  pending: number;
}

type Refusal = ReturnType<typeof mediaRefusal>;

export const MAX_MEDIA_BACKEND_REQUESTS = 16;

/** The media list can not be read, or the app closes. */
export const MEDIA_CLOSED = mediaRefusal(
  'not-found',
  'Media list is unavailable',
);
const NOT_CONNECTED = mediaRefusal(
  'not-found',
  'Media operations are unavailable until the media backend is connected',
);
const TOO_MANY = mediaRefusal('invalid', 'Too many pending media operations');

/** The place of the one media backend, which bounds and checks its calls. */
export class MediaBackendSlot implements MediaBackendPort {
  private connected: ConnectedBackend | null = null;
  private closed = false;

  constructor(
    private readonly ipc: Pick<IpcHost, 'push'>,
    private readonly log: Logger,
  ) {}

  connect(backend: MediaBackend): MediaBackendConnection {
    if (this.closed) throw new Error('Media list is unavailable');
    if (this.connected !== null) {
      throw new Error('A media backend is already connected');
    }
    const connection = {backend, abort: new AbortController(), pending: 0};
    this.connected = connection;
    return {
      report: progress =>
        this.connected === connection && this.report(progress),
      disconnect: () => {
        if (this.connected === connection) this.drop();
      },
    };
  }

  async call<TReply>({
    name,
    run,
    parse,
  }: BackendCall<TReply>): Promise<TReply | Refusal> {
    const connection = this.connected;
    if (connection === null) return NOT_CONNECTED;
    if (connection.pending >= MAX_MEDIA_BACKEND_REQUESTS) return TOO_MANY;
    const {backend, abort} = connection;
    connection.pending++;
    try {
      const reply = await run(backend, abort.signal);
      if (abort.signal.aborted) return MEDIA_CLOSED;
      const checked = parse(reply);
      if (checked.ok) return checked.value;
      this.log.warn(
        `dropped a malformed media backend ${name} result`,
        checked.error,
      );
      return mediaRefusal('invalid', `Invalid media backend ${name} result`);
    } catch (error: unknown) {
      this.log.error(`media backend ${name} failed`, error);
      return mediaRefusal('invalid', `Media backend ${name} failed`);
    } finally {
      connection.pending--;
    }
  }

  close(): void {
    this.closed = true;
    this.drop();
  }

  private drop(): void {
    this.connected?.abort.abort();
    this.connected = null;
  }

  private report(progress: unknown): boolean {
    const parsed = parseMediaImportProgress(progress);
    if (!parsed.ok) {
      this.log.warn('dropped malformed media import progress', parsed.error);
      return false;
    }
    this.ipc.push(mediaEndpoints.importChanged, parsed.value);
    return true;
  }
}
