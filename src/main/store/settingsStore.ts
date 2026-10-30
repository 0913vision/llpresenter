import {join} from 'node:path';
import type {
  EditRefusalReason,
  EditResult,
  EditSuccess,
} from '@core/schema/contentEdit';
import {
  mergeSettingsDocument,
  settingsNames,
  type SettingsDocument,
  type SettingsEdit,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import {
  defaultPreferences,
  withPreferenceDefaults,
  type Preferences,
} from '@core/schema/preferences';
import type {Logger} from '../log';
import type {DocumentFiles} from './contentPersistence';
import {documentFiles} from './documentFiles';
import type {LoadedStore} from './fileStore';
import {RecoveryCopies} from './recoveryCopies';
import type {SaveFailureSink} from './saveFailures';
import {Saver, type SaveRequest} from './saver';
import {settingsCodecs} from './settingsCodecs';
import {settingsFileName} from './settingsFile';
import {loadSettingsArea, type SettingsProblem} from './settingsLoader';
import {SettingsPersistence} from './settingsPersistence';
import {prepareQuickTimerEdit} from './quickTimerEdits';
import {prepareTimerDeletion} from './timerDeletions';
import {stageLayoutReferenceFailure} from './stageLayoutReferences';
import {prepareTimerRename} from './timerRenames';

export type {SettingsProblem} from './settingsLoader';
export type SettingsProblemListener = (problem: SettingsProblem) => void;
export type SettingsListener = (document: SettingsDocument) => void;
export type SettingsReader = Pick<
  SettingsStore,
  'get' | 'preferences' | 'subscribe'
>;

export interface SettingsStoreOptions {
  readonly documents: ReadonlyMap<SettingsName, SettingsDocument>;
  readonly problems: readonly SettingsProblem[];
  readonly log: Logger;
  readonly saving?: {
    readonly folder: string;
    readonly files: DocumentFiles;
    readonly delayMs?: number;
  };
}

function refuse(reason: EditRefusalReason, message: string): EditResult {
  return {ok: false, error: {reason, message}};
}

/** The revisioned app-wide settings, their saves, and change subscriptions. */
export class SettingsStore {
  private readonly documents: Map<SettingsName, SettingsDocument>;
  private readonly problemListeners = new Set<SettingsProblemListener>();
  private readonly problems = new Map<string, SettingsProblem>();
  private readonly listeners = new Set<SettingsListener>();
  private readonly saves: SettingsPersistence | null;
  private disposed = false;
  private closing: Promise<void> | null = null;

  constructor(private readonly options: SettingsStoreOptions) {
    this.documents = new Map(options.documents);
    this.addProblems(options.problems);
    this.saves =
      options.saving === undefined
        ? null
        : new SettingsPersistence(
            options.saving.files,
            options.log,
            options.saving.delayMs,
          );
  }

  get(name: SettingsName): SettingsDocument {
    const document = this.documents.get(name);
    if (document === undefined) {
      throw new Error(`Settings unavailable: ${name}`);
    }
    return document;
  }

  preferences(): Preferences {
    const document = this.documents.get('preferences');
    return document?.name === 'preferences'
      ? withPreferenceDefaults(document.value)
      : defaultPreferences;
  }

  get listenerCount(): number {
    return this.problemListeners.size;
  }

  get changeListenerCount(): number {
    return this.listeners.size;
  }

  /** Applies in memory and broadcasts immediately; the answer includes the debounced write result. */
  apply(edit: SettingsEdit): Promise<EditResult> {
    try {
      return this.update(edit);
    } catch (error: unknown) {
      this.options.log.error('could not apply a settings edit', error);
      return Promise.resolve(
        refuse(
          'invalid',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  subscribe(listener: SettingsListener): () => void {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Replays each skipped startup file once to a new listener. */
  subscribeProblems(listener: SettingsProblemListener): () => void {
    if (this.disposed) return () => undefined;
    if (!this.problemListeners.has(listener)) {
      this.problemListeners.add(listener);
      for (const problem of this.problems.values()) {
        if (!this.problemListeners.has(listener)) break;
        try {
          listener(problem);
        } catch (error: unknown) {
          this.options.log.error('settings problem listener failed', error);
        }
      }
    }
    return () => {
      this.problemListeners.delete(listener);
    };
  }

  /** Adds independently loaded media problems to the same bounded startup notification feed. */
  addProblems(problems: readonly SettingsProblem[]): void {
    if (this.disposed) return;
    for (const problem of problems) {
      if (this.problems.has(problem.file)) continue;
      if (this.problems.size >= settingsNames.length + 1) {
        this.options.log.warn('too many app-wide settings problems', problem);
        continue;
      }
      this.problems.set(problem.file, problem);
      for (const listener of this.problemListeners) {
        try {
          listener(problem);
        } catch (error: unknown) {
          this.options.log.error('settings problem listener failed', error);
        }
      }
    }
  }

  async flush(): Promise<void> {
    await this.saves?.flush();
  }

  /** Starts accepted edits now so a cross-file edit can save this file first. */
  async savePending(): Promise<void> {
    await this.saves?.savePending();
  }

  /** Stops subscriptions immediately and finishes every accepted write before releasing timers. */
  dispose(): Promise<void> {
    this.disposed = true;
    this.listeners.clear();
    this.problemListeners.clear();
    this.closing ??= this.flush().finally(() => this.saves?.dispose());
    return this.closing;
  }

  private update(edit: SettingsEdit): Promise<EditResult> {
    if (edit.type === 'timer.delete') {
      const prepared = prepareTimerDeletion(this.documents, edit);
      return prepared.ok
        ? this.commit(prepared.value)
        : Promise.resolve({ok: false, error: prepared.error});
    }
    if (edit.type === 'timer.rename') {
      const prepared = prepareTimerRename(this.documents, edit);
      return prepared.ok
        ? this.commit(prepared.value)
        : Promise.resolve({ok: false, error: prepared.error});
    }
    if (
      edit.type === 'quick.timer.create' ||
      edit.type === 'quick.timer.rename' ||
      edit.type === 'quick.timers.separate'
    ) {
      const prepared = prepareQuickTimerEdit(this.documents, edit);
      if (!prepared.ok) {
        return Promise.resolve({ok: false, error: prepared.error});
      }
      return this.commit(prepared.value);
    }
    if (edit.type !== 'settings.update') {
      return Promise.resolve(
        refuse('invalid', 'A global label rename requires the content store'),
      );
    }
    const saving = this.options.saving;
    const saves = this.saves;
    if (this.disposed || saving === undefined || saves === null) {
      return Promise.resolve(refuse('not-found', 'Settings are unavailable'));
    }
    const current = this.documents.get(edit.name);
    if (current === undefined) {
      return Promise.resolve(
        refuse('not-found', 'This settings area is unavailable'),
      );
    }
    if (current.access === 'readOnly') {
      return Promise.resolve(
        refuse('read-only', 'A newer app version wrote this file'),
      );
    }
    if (current.revision !== edit.baseRevision) {
      return Promise.resolve(
        refuse('stale', `The file is at revision ${current.revision}`),
      );
    }
    if (current.value.schemaVersion !== edit.value.schemaVersion) {
      return Promise.resolve(
        refuse('invalid', 'An edit cannot change the schema version'),
      );
    }
    const merged = mergeSettingsDocument(current, edit);
    if (!merged.ok) {
      return Promise.resolve(
        refuse('invalid', `${merged.error.field}: ${merged.error.message}`),
      );
    }
    const next = merged.value;
    const referenceFailure = stageLayoutReferenceFailure(this.documents, next);
    if (referenceFailure !== null) {
      return Promise.resolve({ok: false, error: referenceFailure});
    }
    return this.commit({
      documents: [next],
      applied: {id: edit.name, revision: next.revision},
    });
  }

  private commit({
    documents,
    applied,
  }: {
    readonly documents: readonly SettingsDocument[];
    readonly applied: EditSuccess;
  }): Promise<EditResult> {
    const saving = this.options.saving;
    const saves = this.saves;
    if (this.disposed || saving === undefined || saves === null) {
      return Promise.resolve(refuse('not-found', 'Settings are unavailable'));
    }
    const requests: SaveRequest[] = [];
    for (const document of documents) {
      const file = join(saving.folder, settingsFileName(document.name));
      const text = settingsCodecs[document.name].serialize(
        document.value,
        file,
      );
      if (!text.ok) {
        return Promise.resolve(refuse('invalid', text.error.message));
      }
      requests.push({
        target: {file, kind: 'settings', id: document.name},
        text: text.value,
      });
    }
    for (const document of documents) {
      this.documents.set(document.name, document);
    }
    const written = requests.map(request => saves.save(request));
    for (const document of documents) this.announce(document);
    return Promise.all(written).then((results): EditResult => {
      const failures = results.flatMap(result =>
        result.ok ? [] : [result.error],
      );
      if (failures.length === 0) return {ok: true, value: applied};
      return {
        ok: false,
        error: {
          reason: 'write-failed',
          message: failures.map(error => error.message).join('; '),
          applied,
          unchangedFiles: failures.map(error => error.file),
        },
      };
    });
  }

  private announce(document: SettingsDocument): void {
    for (const listener of this.listeners) {
      if (this.disposed) break;
      try {
        listener(document);
      } catch (error: unknown) {
        this.options.log.error('settings change listener failed', error);
      }
    }
  }
}

/** Loads each area independently and creates only missing files through the M2 saver. */
export async function openSettingsStore(
  store: LoadedStore,
  log: Logger,
  failures?: SaveFailureSink,
): Promise<SettingsStore> {
  let opened: SettingsStore | null = null;
  const copies = new RecoveryCopies({
    folder: store.locations.recovery,
    keep: () =>
      opened?.preferences().backupCopies ?? store.preferences.backupCopies,
  });
  const saver = new Saver({
    copies,
    reportCopyProblem: error =>
      log.warn('could not keep a recovery copy', error),
  });
  const documents = new Map<SettingsName, SettingsDocument>();
  const problems: SettingsProblem[] = [];
  for (const name of settingsNames) {
    const area = await loadSettingsArea(name, store.locations, saver);
    if (area.document !== null) documents.set(name, area.document);
    if (area.problem !== null) {
      problems.push(area.problem);
      log.warn('skipped a data file or a part of one', area.problem.error);
    }
  }
  opened = new SettingsStore({
    documents,
    problems,
    log,
    saving: {
      folder: store.locations.settings,
      files: documentFiles({saver, copies, log, failures}),
    },
  });
  return opened;
}
