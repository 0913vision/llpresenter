import {basename} from 'node:path';
import type {FileError, LoadedFile} from '@shared/schema/fileFormat';
import {
  parseSettingsDocument,
  settingsNames,
  type SettingsDocument,
  type SettingsName,
} from '@shared/schema/settingsDocuments';
import type {Logger} from '../log';
import type {LoadedStore} from './fileStore';
import {RecoveryCopies} from './recoveryCopies';
import {Saver} from './saver';
import {settingsCodecs, type SettingsValue} from './settingsCodecs';
import {settingsDefaults} from './settingsDefaults';
import {readSettingsFile, settingsLocation} from './settingsFile';

/** One skipped settings file. S2a connects these main-process events to windows. */
export interface SettingsProblem {
  readonly file: string;
  readonly error: FileError;
}
export type SettingsProblemListener = (problem: SettingsProblem) => void;

/** Revisioned settings reads and bounded startup problems, owned by the main process. */
export class SettingsStore {
  private readonly listeners = new Set<SettingsProblemListener>();
  private disposed = false;
  constructor(
    private readonly documents: ReadonlyMap<SettingsName, SettingsDocument>,
    private readonly problems: readonly SettingsProblem[],
    private readonly log: Logger,
  ) {}
  get(name: SettingsName): SettingsDocument {
    const document = this.documents.get(name);
    if (!document) throw new Error(`Settings unavailable: ${name}`);
    return document;
  }
  get listenerCount(): number {
    return this.listeners.size;
  }
  /** Replays each skipped startup file once to a new listener. */
  subscribeProblems(listener: SettingsProblemListener): () => void {
    if (this.disposed) return () => undefined;
    if (!this.listeners.has(listener)) {
      this.listeners.add(listener);
      for (const problem of this.problems) {
        try {
          listener(problem);
        } catch (error: unknown) {
          this.log.error('settings problem listener failed', error);
        }
      }
    }
    return () => {
      this.listeners.delete(listener);
    };
  }
  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}

/** Loads each area independently, creating only missing files through the M2 saver. */
export async function openSettingsStore(
  store: LoadedStore,
  log: Logger,
): Promise<SettingsStore> {
  const copies = new RecoveryCopies({
    folder: store.locations.recovery,
    keep: () => store.preferences.backupCopies,
  });
  const saver = new Saver({
    copies,
    reportCopyProblem: error =>
      log.warn('could not keep a recovery copy', error),
  });
  const documents = new Map<SettingsName, SettingsDocument>();
  const problems: SettingsProblem[] = [];
  for (const name of settingsNames) {
    const location = settingsLocation(store.locations, name);
    const codec = settingsCodecs[name];
    // NOTE(0913vision): Carry metadata inside data so the M2 recovery reader
    // preserves a recovered file's access flag without another reading path.
    const read = await readSettingsFile<LoadedFile<SettingsValue>>(
      location,
      (text, file) => {
        const parsed = codec.parse(text, file);
        return parsed.ok
          ? {ok: true, value: {...parsed.value, data: parsed.value}}
          : parsed;
      },
    );
    const fallback = codec.parse(
      JSON.stringify({
        format:
          name === 'stage-layouts' ? 'llsettings.stage' : `llsettings.${name}`,
        schemaVersion: 1,
        ...settingsDefaults[name],
      }),
      location.file,
    );
    if (!fallback.ok) {
      throw new Error(
        `Invalid defaults for ${name}: ${fallback.error.message}`,
      );
    }
    const loaded = read.data ?? fallback.value;
    const document = parseSettingsDocument({
      name,
      value: loaded.data,
      access: loaded.access,
      revision: 1,
    });
    if (!document.ok) {
      throw new Error(`Invalid settings document: ${document.error.message}`);
    }
    documents.set(name, document.value);
    const [error] = read.problems;
    if (error) {
      problems.push({file: basename(location.file), error});
      log.warn('skipped a data file or a part of one', error);
    } else if (read.data === null) {
      const text = codec.serialize(loaded.data, location.file);
      if (!text.ok) throw new Error(text.error.message);
      const saved = await saver.save({
        target: {file: location.file, kind: 'settings', id: name},
        text: text.value,
      });
      if (!saved.ok) log.warn('could not create a settings file', saved.error);
    }
  }
  return new SettingsStore(documents, problems, log);
}
