import {deletedObjectShortcuts} from '@core/shortcuts';
import {applySettingsDeletionDelta} from './settingsDeletionDelta';
import type {
  SettingsListener,
  SettingsReader,
} from '@core/schema/app/settingsReader';
import {join} from 'node:path';
import type {Result} from '@core/common/result';
import type {
  EditFailure,
  EditRefusalReason,
  EditResult,
  EditSuccess,
} from '@core/schema/services/contentEdit';
import {
  mergeSettingsDocument,
  parseSettingsDocument,
  settingsNames,
  type SettingsDocument,
  type SettingsEdit,
  type SettingsName,
} from '@core/schema/app/settingsDocuments';
import {
  defaultPreferences,
  withPreferenceDefaults,
  type Preferences,
} from '@core/schema/app/preferences';
import type {OnProgress} from '../../base/launchTracker';
import type {Logger} from '../../base/log';
import type {DocumentFiles, PersistedFile} from '../content/contentPersistence';
import type {WriteResult} from '../files/fileWriter';
import {documentFiles} from '../files/documentFiles';
import type {LoadedStore} from '../locations/fileStore';
import {RecoveryCopies, type RecoveryTarget} from '../files/recoveryCopies';
import type {SaveFailureSink} from '../files/saveFailures';
import {Saver, type SaveRequest} from '../files/saver';
import {settingsCodecs} from './settingsCodecs';
import {settingsFileName} from './settingsFile';
import {loadSettingsArea, type SettingsProblem} from './settingsLoader';
import {SettingsPersistence} from './settingsPersistence';
import {themeWrites} from './themeFiles';
import {prepareQuickTimerEdit} from './quickTimerEdits';
import {prepareTimerDeletion} from './timerDeletions';
import {prepareTimerRename} from './timerRenames';
import {
  removedSettingsObject,
  SettingsDeleteHistory,
} from './settingsDeleteHistory';

/** Hears a problem of a settings file. */
export type SettingsProblemListener = (problem: SettingsProblem) => void;

/**
 * What the settings store starts from: the documents read at launch, the
 * problems found, the log, and optionally where and how it saves.
 */
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

/** A settings update: one whole area, at the revision the window read. */
type SettingsUpdate = Extract<SettingsEdit, {type: 'settings.update'}>;

/**
 * The document a settings update makes of the current one, or why it is
 * refused: the area is gone or read-only, the window read an older revision,
 * or the update does not fit the area.
 */
function updatedDocument(
  current: SettingsDocument | undefined,
  edit: SettingsUpdate,
): Result<SettingsDocument, EditFailure> {
  const refused = (reason: EditRefusalReason, message: string) =>
    ({ok: false, error: {reason, message}}) as const;
  if (current === undefined) {
    return refused('not-found', 'This settings area is unavailable');
  }
  if (current.access === 'readOnly') {
    return refused('read-only', 'A newer app version wrote this file');
  }
  if (current.revision !== edit.baseRevision) {
    return refused('stale', `The file is at revision ${current.revision}`);
  }
  if (current.value.schemaVersion !== edit.value.schemaVersion) {
    return refused('invalid', 'An edit cannot change the schema version');
  }
  const merged = mergeSettingsDocument(current, edit);
  return merged.ok
    ? merged
    : refused('invalid', `${merged.error.field}: ${merged.error.message}`);
}

/**
 * The files the changed documents are written to, and the theme files that
 * go; or why one of them can't be written.
 */
function settingsWrites(
  documents: ReadonlyMap<SettingsName, SettingsDocument>,
  changes: readonly SettingsDocument[],
  folder: string,
): Result<
  {readonly requests: SaveRequest[]; readonly removals: RecoveryTarget[]},
  string
> {
  const requests: SaveRequest[] = [];
  const removals: RecoveryTarget[] = [];
  for (const document of changes) {
    const current = documents.get(document.name);
    if (document.name === 'themes' && current?.name === 'themes') {
      const writes = themeWrites(current.value, document.value, folder);
      if (!writes.ok) return {ok: false, error: writes.error.message};
      requests.push(...writes.value.saves);
      removals.push(...writes.value.removals);
      continue;
    }
    const file = join(folder, settingsFileName(document.name));
    const text = settingsCodecs[document.name].serialize(document.value, file);
    if (!text.ok) return {ok: false, error: text.error.message};
    requests.push({
      target: {file, kind: 'settings', id: document.name},
      text: text.value,
    });
  }
  return {ok: true, value: {requests, removals}};
}

/** The revisioned app-wide settings, their saves, and change subscriptions. */
export class SettingsStore implements SettingsReader {
  private readonly documents: Map<SettingsName, SettingsDocument>;
  private readonly problemListeners = new Set<SettingsProblemListener>();
  private readonly problems = new Map<string, SettingsProblem>();
  private readonly listeners = new Set<SettingsListener>();
  private readonly saves: SettingsPersistence | null;
  private disposed = false;
  private closing: Promise<void> | null = null;
  private readonly deletions = new SettingsDeleteHistory();

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

  /** Returns durability results when an applied rename retries queued files. */
  async retryPending(): Promise<readonly PersistedFile[]> {
    return this.saves?.retryPending() ?? [];
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
    if (
      edit.type === 'settings.undoDelete' ||
      edit.type === 'settings.redoDelete'
    ) {
      return this.replayDeletion(
        edit.area,
        edit.type === 'settings.undoDelete',
        edit.expectedRevision,
      );
    }
    if (edit.type === 'timer.delete') {
      const prepared = prepareTimerDeletion(this.documents, edit);
      return prepared.ok
        ? this.commit({...prepared.value, historyKey: 'timers'})
        : Promise.resolve({ok: false, error: prepared.error});
    }
    if (edit.type === 'timer.rename') {
      const prepared = prepareTimerRename(this.documents, edit);
      return prepared.ok
        ? this.commit({...prepared.value, completion: 'saved'})
        : Promise.resolve({ok: false, error: prepared.error});
    }
    if (
      edit.type === 'quick.timer.create' ||
      edit.type === 'quick.timer.rename'
    ) {
      const prepared = prepareQuickTimerEdit(this.documents, edit);
      if (!prepared.ok) {
        return Promise.resolve({ok: false, error: prepared.error});
      }
      return this.commit({
        ...prepared.value,
        completion: edit.type === 'quick.timer.rename' ? 'saved' : 'applied',
      });
    }
    if (edit.type !== 'settings.update') {
      return Promise.resolve(
        refuse('invalid', 'A global label rename requires the content store'),
      );
    }
    if (this.disposed || this.options.saving === undefined || !this.saves) {
      return Promise.resolve(refuse('not-found', 'Settings are unavailable'));
    }
    const current = this.documents.get(edit.name);
    const updated = updatedDocument(current, edit);
    if (!updated.ok) return Promise.resolve(updated);
    const next = updated.value;
    return this.commit({
      documents: [next],
      applied: {id: edit.name, revision: next.revision},
      immediateLabelSave: edit.name === 'labels',
      ...(current !== undefined && removedSettingsObject(current, next)
        ? {historyKey: edit.name}
        : {}),
    });
  }

  private replayDeletion(
    name: SettingsName,
    undo: boolean,
    expectedRevision: number,
  ): Promise<EditResult> {
    const direction = undo ? 'undo' : 'redo';
    const step = this.deletions.latest(name, direction);
    if (step === undefined) {
      return Promise.resolve(refuse('not-found', 'No deletion to undo'));
    }
    if (
      step.after.find(document => document.name === name)?.revision !==
      expectedRevision
    ) {
      return Promise.resolve(
        refuse('stale', 'Another deletion happened more recently'),
      );
    }
    const expected = undo ? step.after : step.before;
    const target = undo ? step.before : step.after;
    const documents: SettingsDocument[] = [];
    for (const desired of target) {
      const current = this.documents.get(desired.name);
      const check = expected.find(value => value.name === desired.name);
      if (current?.access !== 'editable' || !check) {
        return Promise.resolve(
          refuse('stale', 'Settings changed since the deletion'),
        );
      }
      const patched = applySettingsDeletionDelta(
        current.value,
        check.value,
        desired.value,
      );
      if (!patched.ok) {
        return Promise.resolve(
          refuse('stale', 'The deleted settings were changed'),
        );
      }
      const parsed = parseSettingsDocument({
        ...current,
        revision: current.revision + 1,
        value: patched.value,
      });
      if (!parsed.ok) {
        return Promise.resolve(refuse('invalid', parsed.error.message));
      }
      documents.push(parsed.value);
    }
    const revision = this.documents.get(name)?.revision;
    const result = this.commit({
      documents,
      applied: {id: name, revision: (revision ?? 0) + 1},
    });
    if (this.documents.get(name)?.revision !== revision) {
      this.deletions.replayed(name, direction);
    }
    return result;
  }

  private commit({
    documents,
    applied,
    completion = 'applied',
    immediateLabelSave = false,
    historyKey,
  }: {
    readonly documents: readonly SettingsDocument[];
    readonly applied: EditSuccess;
    readonly completion?: 'applied' | 'saved';
    readonly immediateLabelSave?: boolean;
    readonly historyKey?: SettingsName | undefined;
  }): Promise<EditResult> {
    const saving = this.options.saving;
    const saves = this.saves;
    if (this.disposed || saving === undefined || saves === null) {
      return Promise.resolve(refuse('not-found', 'Settings are unavailable'));
    }
    const shortcuts = deletedObjectShortcuts(this.documents, documents);
    const changes =
      shortcuts === null
        ? documents
        : [
            ...documents.filter(document => document.name !== 'shortcuts'),
            shortcuts,
          ];
    const writes = settingsWrites(this.documents, changes, saving.folder);
    if (!writes.ok) return Promise.resolve(refuse('invalid', writes.error));
    const {requests, removals} = writes.value;
    const before =
      historyKey === undefined
        ? []
        : changes.flatMap(document => {
            const old = this.documents.get(document.name);
            return old ? [old] : [];
          });
    for (const document of changes) {
      this.documents.set(document.name, document);
    }
    if (historyKey !== undefined && before.length === changes.length) {
      this.deletions.record(historyKey, {before, after: changes});
    }
    const written = requests.map(request =>
      saves.save(request, immediateLabelSave && request.target.id === 'labels'),
    );
    for (const target of removals) written.push(saves.remove(target));
    for (const document of changes) this.announce(document);
    if (documents.length === 0 && completion === 'saved') {
      return saves.retryPending().then(results =>
        this.commitResult(
          applied,
          results.map(row => row.result),
        ),
      );
    }
    return Promise.all(written).then(results =>
      this.commitResult(applied, results),
    );
  }

  private commitResult(
    applied: EditSuccess,
    results: readonly WriteResult[],
  ): EditResult {
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

/** Loads each area independently and creates only missing files through the saver. */
export async function openSettingsStore(
  store: LoadedStore,
  log: Logger,
  {
    failures,
    onProgress = () => undefined,
  }: {
    readonly failures?: SaveFailureSink | undefined;
    readonly onProgress?: OnProgress | undefined;
  } = {},
): Promise<SettingsStore> {
  let opened: SettingsStore | null = null;
  let startupPreferences = defaultPreferences;
  const copies = new RecoveryCopies({
    folder: store.locations.recovery,
    keep: () =>
      opened?.preferences().backupCopies ?? startupPreferences.backupCopies,
  });
  const saver = new Saver({
    copies,
    onCopyResult: (file, ok) => failures?.copyResult?.(file, ok),
    reportCopyProblem: error =>
      log.warn('could not keep a recovery copy', error),
  });
  const documents = new Map<SettingsName, SettingsDocument>();
  const problems: SettingsProblem[] = [];
  let read = 0;
  for (const name of [
    'preferences',
    ...settingsNames.filter(name => name !== 'preferences'),
  ] as const) {
    const area = await loadSettingsArea(name, store.locations, saver);
    onProgress(++read, settingsNames.length);
    if (area.document !== null) {
      documents.set(name, area.document);
      if (area.document.name === 'preferences') {
        startupPreferences = withPreferenceDefaults(area.document.value);
      }
    }
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
