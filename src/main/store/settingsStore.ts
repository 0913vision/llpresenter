import {deletedObjectShortcuts} from '@core/shortcuts';
import {applySettingsDeletionDelta} from './settingsDeletionDelta';
import type {
  SettingsListener,
  SettingsReader,
} from '@core/schema/settingsReader';
import {join} from 'node:path';
import type {
  EditRefusalReason,
  EditResult,
  EditSuccess,
} from '@core/schema/contentEdit';
import {
  mergeSettingsDocument,
  parseSettingsDocument,
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
import type {DocumentFiles, PersistedFile} from './contentPersistence';
import type {WriteResult} from './fileWriter';
import {documentFiles} from './documentFiles';
import type {LoadedStore} from './fileStore';
import {RecoveryCopies, type RecoveryTarget} from './recoveryCopies';
import type {SaveFailureSink} from './saveFailures';
import {Saver, type SaveRequest} from './saver';
import {settingsCodecs} from './settingsCodecs';
import {settingsFileName} from './settingsFile';
import {loadSettingsArea, type SettingsProblem} from './settingsLoader';
import {SettingsPersistence} from './settingsPersistence';
import {themeWrites} from './themeFiles';
import {prepareQuickTimerEdit} from './quickTimerEdits';
import {prepareTimerDeletion} from './timerDeletions';
import {prepareTimerRename} from './timerRenames';

export type {SettingsProblem} from './settingsLoader';
export type SettingsProblemListener = (problem: SettingsProblem) => void;

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

interface SettingsDeleteStep {
  readonly before: readonly SettingsDocument[];
  readonly after: readonly SettingsDocument[];
}

function removedSettingsObject(
  before: SettingsDocument,
  after: SettingsDocument,
): boolean {
  if (before.name !== after.name) return false;
  if (before.name === 'macros' && after.name === 'macros') {
    const current = new Map(after.value.macros.map(macro => [macro.id, macro]));
    if (
      before.value.macros.some(macro => {
        const next = current.get(macro.id);
        return next !== undefined && next.actions.length < macro.actions.length;
      })
    ) {
      return true;
    }
  }
  const fields: Partial<Record<SettingsName, readonly string[]>> = {
    screens: ['screens'],
    themes: ['themes'],
    macros: ['macros', 'collections'],
    quick: ['items'],
    messages: ['templates'],
    props: ['props'],
    timers: ['timers'],
    labels: ['labels'],
  };
  return (fields[before.name] ?? []).some(field => {
    const oldRows: unknown = Reflect.get(before.value, field);
    const newRows: unknown = Reflect.get(after.value, field);
    if (!Array.isArray(oldRows) || !Array.isArray(newRows)) return false;
    const idOf = (row: unknown): string | undefined => {
      if (row === null || typeof row !== 'object') return undefined;
      const id: unknown = Reflect.get(
        row,
        before.name === 'labels' ? 'name' : 'id',
      );
      return typeof id === 'string' ? id : undefined;
    };
    const checkedNew: readonly unknown[] = newRows;
    const checkedOld: readonly unknown[] = oldRows;
    if (before.name === 'labels' && checkedNew.length >= checkedOld.length) {
      return false;
    }
    const ids = new Set(checkedNew.map(idOf));
    return checkedOld.some(row => {
      const id = idOf(row);
      return id !== undefined && !ids.has(id);
    });
  });
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
  private readonly deleteHistory = new Map<
    SettingsName,
    {undo: SettingsDeleteStep[]; redo: SettingsDeleteStep[]}
  >();

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
    return this.commit({
      documents: [next],
      applied: {id: edit.name, revision: next.revision},
      immediateLabelSave: edit.name === 'labels',
      ...(removedSettingsObject(current, next) ? {historyKey: edit.name} : {}),
    });
  }

  private replayDeletion(
    name: SettingsName,
    undo: boolean,
    expectedRevision: number,
  ): Promise<EditResult> {
    const history = this.deleteHistory.get(name);
    const from = undo ? history?.undo : history?.redo;
    const to = undo ? history?.redo : history?.undo;
    const step = from?.at(-1);
    if (!step || !from || !to) {
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
      from.pop();
      to.push(step);
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
    const requests: SaveRequest[] = [];
    const removals: RecoveryTarget[] = [];
    for (const document of changes) {
      const current = this.documents.get(document.name);
      if (document.name === 'themes' && current?.name === 'themes') {
        const writes = themeWrites(
          current.value,
          document.value,
          saving.folder,
        );
        if (!writes.ok) {
          return Promise.resolve(refuse('invalid', writes.error.message));
        }
        requests.push(...writes.value.saves);
        removals.push(...writes.value.removals);
        continue;
      }
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
      const history = this.deleteHistory.get(historyKey) ?? {
        undo: [],
        redo: [],
      };
      history.undo.push({before, after: changes});
      if (history.undo.length > 100) history.undo.shift();
      history.redo = [];
      this.deleteHistory.set(historyKey, history);
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
  failures?: SaveFailureSink,
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
  for (const name of [
    'preferences',
    ...settingsNames.filter(name => name !== 'preferences'),
  ] as const) {
    const area = await loadSettingsArea(name, store.locations, saver);
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
