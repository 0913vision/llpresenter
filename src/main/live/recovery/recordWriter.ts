import type {LiveState} from '@shared/live';
import type {Result} from '@shared/result';
import type {ServiceId} from '@shared/schema/ids';
import {serializeRecoveryRecord} from '@shared/schema/recoveryRecord';
import type {Logger} from '../../log';
import {writeFileAtomically, type WriteProblem} from '../../store/atomicWrite';
import type {LiveStore} from '../store';

/** At most one record write per interval (docs/spec/02-data.md, proposal). */
export const RECORD_INTERVAL_MS = 1000;

const RECORD_FORMAT = 'llrecovery';
const RECORD_SCHEMA_VERSION = 1;

interface RecordWriterOptions {
  readonly file: string;
  readonly store: Pick<LiveStore, 'state' | 'subscribe'>;
  /** The open 예배 순서, which the record keeps beside the live state. */
  readonly serviceId: () => ServiceId | null;
  readonly log: Logger;
  readonly now?: () => number;
  readonly intervalMs?: number;
  readonly write?: (
    file: string,
    text: string,
  ) => Promise<Result<void, WriteProblem>>;
}

/** The state as recovery restores it: audio and clear undo are never saved. */
function recordedState(state: LiveState): LiveState {
  return {
    ...state,
    canUndo: false,
    layers: {...state.layers, audio: null},
  };
}

/**
 * Keeps `live.json` close to the live state: one write right away, then at
 * most one per interval while the state changes, with one write in flight and
 * later changes folded into the next one. A failed write keeps the previous
 * record and is logged once until a write succeeds again.
 */
export class RecoveryRecordWriter {
  private stopFollowing: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> | null = null;
  private pending = false;
  private stopped = false;
  private failing = false;
  private lastState: LiveState | null = null;
  private lastServiceId: ServiceId | null = null;

  constructor(private readonly options: RecordWriterOptions) {}

  /** Writes the current state and follows its changes; later calls do nothing. */
  start(): void {
    if (this.stopped || this.stopFollowing !== null) return;
    this.stopFollowing = this.options.store.subscribe(this.schedule);
    this.request();
  }

  /** Stops following the state and drops later writes; a write in flight still finishes. */
  stop(): void {
    this.stopped = true;
    this.pending = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.stopFollowing?.();
    this.stopFollowing = null;
  }

  /** Resolves once no write is in flight. */
  async settled(): Promise<void> {
    await this.writing;
  }

  private readonly schedule = (): void => {
    if (this.timer !== null || this.stopped) return;
    this.timer = setTimeout(
      this.writeLater,
      this.options.intervalMs ?? RECORD_INTERVAL_MS,
    );
  };

  private readonly writeLater = (): void => {
    this.timer = null;
    this.request();
  };

  private request(): void {
    if (this.stopped) return;
    if (this.writing !== null) {
      this.pending = true;
      return;
    }
    this.writing = this.writeCurrent().finally(() => {
      this.writing = null;
      if (!this.pending) return;
      this.pending = false;
      this.request();
    });
  }

  private async writeCurrent(): Promise<void> {
    const {
      store,
      file,
      log,
      now = Date.now,
      write = writeFileAtomically,
    } = this.options;
    try {
      const state = store.state;
      const serviceId = this.options.serviceId();
      if (state === this.lastState && serviceId === this.lastServiceId) return;
      const text = serializeRecoveryRecord({
        format: RECORD_FORMAT,
        schemaVersion: RECORD_SCHEMA_VERSION,
        savedAt: new Date(now()).toISOString(),
        serviceId,
        state: recordedState(state),
      });
      if (!text.ok) {
        this.reportFailure(text.error);
        return;
      }
      const written = await write(file, text.value);
      if (!written.ok) {
        this.reportFailure(written.error);
        return;
      }
      this.lastState = state;
      this.lastServiceId = serviceId;
      if (this.failing) log.info('the recovery record is written again');
      this.failing = false;
    } catch (error: unknown) {
      this.reportFailure(error);
    }
  }

  private reportFailure(error: unknown): void {
    if (!this.failing) {
      this.options.log.warn('could not write the recovery record', error);
    }
    this.failing = true;
  }
}

/** The part of the content store that names the open 예배 순서. */
interface OpenServiceSource {
  readonly openServiceId: string | null;
  storedService(
    id: string,
  ): {readonly data: {readonly id: ServiceId}} | undefined;
}

/** The open 예배 순서 once the content is read; null before that or without one. */
export function openServiceIdOf(
  content: Promise<OpenServiceSource | null>,
  log: Logger,
): () => ServiceId | null {
  let ready: OpenServiceSource | null = null;
  void content.then(
    store => {
      ready = store;
    },
    (error: unknown) =>
      log.error('could not follow the open service for recovery', error),
  );
  return () => {
    const id = ready?.openServiceId ?? null;
    return id === null ? null : (ready?.storedService(id)?.data.id ?? null);
  };
}
