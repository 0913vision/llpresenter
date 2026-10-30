import {readFile, stat} from 'node:fs/promises';
import type {
  RecoveryApply,
  RecoveryFailure,
  RecoveryResult,
  RecoverySummary,
} from '@core/schema/recovery';
import {
  parseRecoveryRecord,
  RECOVERY_RECORD_LIMITS,
  type RecoveryRecord,
} from '@core/schema/recoveryRecord';
import type {Logger} from '../../log';
import {isMissingFile} from '../../store/fsErrors';
import {dispatchBatched, type LiveStore} from '../store';
import {
  lookCommands,
  planRecovery,
  type RecoveryContent,
  type RecoverySources,
  type RecoveryStep,
} from './plan';
import type {RecoveryRecordWriter} from './recordWriter';

/** The answers of the recovery dialog, as the IPC channels call them. */
export interface RecoveryPort {
  summary(): Promise<RecoverySummary>;
  apply(request: RecoveryApply): Promise<RecoveryResult>;
  startFresh(): Promise<RecoveryResult>;
}

interface RecoveryOptions {
  readonly crashed: boolean;
  /** `live.json`, read once after a crash. */
  readonly file: string;
  readonly store: LiveStore;
  readonly sources: Promise<RecoverySources | null>;
  readonly record: Pick<RecoveryRecordWriter, 'start'>;
  /** 켤 때 화면 출력, as on a normal launch. Never throws. */
  readonly showOutputsOnLaunch: () => Promise<void>;
  /** Runs the startup 매크로 that a crashed launch held back. */
  readonly runStartupMacros: () => Promise<void>;
  readonly log: Logger;
}

interface Offer {
  readonly record: RecoveryRecord;
  readonly sources: RecoverySources;
}

interface Waiting {
  readonly offer: Offer;
  readonly steps: readonly RecoveryStep[];
}

const OK: RecoveryResult = {ok: true, value: null};

/** The settings and content once both are read, or null when either can't be. */
export async function recoverySources(
  data: {
    readonly settings: Promise<RecoverySources['settings'] | null>;
    readonly content: Promise<RecoveryContent | null>;
  },
  log: Logger,
): Promise<RecoverySources | null> {
  try {
    const [settings, content] = await Promise.all([
      data.settings,
      data.content,
    ]);
    return settings === null || content === null ? null : {settings, content};
  } catch (error: unknown) {
    log.error('could not read the recovery sources', error);
    return null;
  }
}

function failure(
  reason: RecoveryFailure['reason'],
  message: string,
): RecoveryResult {
  return {ok: false, error: {reason, message}};
}

const UNAVAILABLE = failure(
  'unavailable',
  'No output state is waiting to be restored',
);

async function readRecord(
  file: string,
  log: Logger,
): Promise<RecoveryRecord | null> {
  let text: string;
  try {
    const {size} = await stat(file);
    if (size > RECOVERY_RECORD_LIMITS.bytes) {
      log.warn('ignored a recovery record over its byte limit', {size});
      return null;
    }
    text = await readFile(file, 'utf8');
  } catch (error: unknown) {
    if (isMissingFile(error)) log.info('no recovery record after the crash');
    else log.warn('could not read the recovery record', error);
    return null;
  }
  const parsed = parseRecoveryRecord(text);
  if (!parsed.ok) {
    log.warn('ignored an invalid recovery record', parsed.error);
    return null;
  }
  return parsed.value.data;
}

/**
 * Decides the launch after a crash (docs/spec/08-problems.md, "Crash and
 * restart"). Outputs stay off and the record stays on disk until the operator
 * answers. 복구 applies the checked rows in order without start or startup
 * 매크로; 새로 시작 launches as normal. A record with nothing left to restore
 * answers 새로 시작 by itself. Either answer then starts the record of this
 * session, which replaces the old one. A normal launch starts it at once.
 */
export class RecoveryController implements RecoveryPort {
  private answered: boolean;
  private freshLaunch: Promise<RecoveryResult> | null = null;
  private readonly offer: Promise<Offer | null>;

  constructor(private readonly options: RecoveryOptions) {
    this.answered = !options.crashed;
    this.offer = options.crashed ? this.loadOffer() : Promise.resolve(null);
  }

  /** Starts a normal launch, or after a crash waits for an offer worth asking about. */
  async start(): Promise<void> {
    if (!this.options.crashed) {
      this.options.record.start();
      await this.options.showOutputsOnLaunch();
      return;
    }
    this.waiting(await this.offer);
    await this.freshLaunch;
  }

  async summary(): Promise<RecoverySummary> {
    const waiting = this.waiting(await this.offer);
    if (waiting === null) return null;
    return {
      savedAt: waiting.offer.record.savedAt,
      rows: waiting.steps.map(({row}) => row),
    };
  }

  async apply({savedAt, rows}: RecoveryApply): Promise<RecoveryResult> {
    const waiting = this.waiting(await this.offer);
    if (waiting === null) return UNAVAILABLE;
    if (savedAt !== waiting.offer.record.savedAt) {
      return failure('stale', 'The recovery record changed since the summary');
    }
    const offered = new Set(waiting.steps.map(({row}) => row.kind));
    if (!rows.every(kind => offered.has(kind))) {
      return failure('invalid-selection', 'A selected row is not offered');
    }
    this.answered = true;
    const {record, sources} = waiting.offer;
    const commands = [
      ...lookCommands(record.state, sources.settings),
      ...waiting.steps
        .filter(({row}) => rows.includes(row.kind))
        .flatMap(({commands: rowCommands}) => rowCommands),
    ];
    try {
      if (!dispatchBatched(this.options.store, commands, this.options.log)) {
        this.options.log.warn('nothing of the output state was restored', {
          rows,
        });
        return failure('apply-failed', 'Nothing could be restored');
      }
      this.options.log.info('restored the output state', {rows});
      return OK;
    } catch (error: unknown) {
      this.options.log.error('could not restore the output state', error);
      return failure('apply-failed', 'The output state could not be restored');
    } finally {
      this.options.record.start();
    }
  }

  async startFresh(): Promise<RecoveryResult> {
    const waiting = this.waiting(await this.offer);
    if (waiting === null) return UNAVAILABLE;
    return this.launchFresh();
  }

  private async loadOffer(): Promise<Offer | null> {
    const record = await readRecord(this.options.file, this.options.log);
    if (record === null) return null;
    const sources = await this.options.sources;
    if (sources === null) {
      this.options.log.warn('recovery has no settings or content to check');
      return null;
    }
    return {record, sources};
  }

  // NOTE(0913vision): Callers check and claim the answer in the same task
  // as this call, with no await in between, so two answers never both apply.
  private waiting(offer: Offer | null): Waiting | null {
    if (this.answered) return null;
    const steps =
      offer === null ? [] : planRecovery(offer.record, offer.sources);
    if (offer !== null && steps.length > 0) return {offer, steps};
    this.options.log.info('nothing to restore after the crash');
    this.freshLaunch = this.launchFresh();
    return null;
  }

  private async launchFresh(): Promise<RecoveryResult> {
    this.answered = true;
    this.options.record.start();
    await this.options.showOutputsOnLaunch();
    try {
      await this.options.runStartupMacros();
      return OK;
    } catch (error: unknown) {
      this.options.log.error('could not run the startup macros', error);
      return failure('apply-failed', 'The startup macros could not run');
    }
  }
}
