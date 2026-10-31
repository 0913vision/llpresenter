import type {
  EditRefusalReason,
  EditResult,
  EditSuccess,
} from '@core/schema/contentEdit';
import type {GroupedSong} from '@core/schema/groupedSong';
import type {Service, Template} from '@core/schema/service';
import {basename} from 'node:path';
import type {Logger} from '../log';
import {Autosave} from './autosave';
import type {
  Checked,
  ContentCommandContext,
  Kind,
  Written,
} from './contentCommands';
import {ContentPersistence, type DocumentFiles} from './contentPersistence';
import type {DocumentCollection, StoredDocument} from './documents';
import type {WriteResult} from './fileWriter';
import {QueuedSaves} from './queuedSaves';
import type {RecoveryTarget} from './recoveryCopies';

/**
 * Borrows current collections for failure-card names and the existing file/log
 * ports. Construction does not load documents or register another edit queue.
 */
export interface ContentWriteOptions {
  readonly songs: DocumentCollection<GroupedSong>;
  readonly services: DocumentCollection<Service>;
  readonly templates: DocumentCollection<Template>;
  readonly files: DocumentFiles;
  readonly log: Logger;
  readonly writeDelayMs?: number | undefined;
}

/**
 * Owns content admission, per-file coalescing and failed-write recovery. Flush
 * phases stay separate so the facade controls their order after its edit queue;
 * this port does not apply document edits or publish changes.
 */
export interface ContentWritePort extends Pick<
  ContentCommandContext,
  'flushAutosave' | 'savesFull' | 'write' | 'remove' | 'saveLater' | 'saveSoon'
> {
  flushPersistence(): Promise<void>;
  retryPending(): Promise<readonly Written[]>;
  takePending(file: string): (result: WriteResult) => void;
  idle(file: string): Promise<void>;
  dispose(): void;
}

class ContentWrites implements ContentWritePort {
  private readonly autosave: Autosave;
  private readonly persistence: ContentPersistence;
  private readonly queuedSaves: QueuedSaves;

  constructor(private readonly options: ContentWriteOptions) {
    this.persistence = new ContentPersistence(
      options.files,
      options.log,
      file => this.nameOfFile(file),
    );
    this.autosave = new Autosave(
      (key, error) => options.log.error('could not save a file', {key, error}),
      options.writeDelayMs,
    );
    this.queuedSaves = new QueuedSaves(this.autosave, options.log);
  }

  flushAutosave(): Promise<void> {
    return this.autosave.flush();
  }

  flushPersistence(): Promise<void> {
    return this.persistence.flush();
  }

  retryPending(): Promise<readonly Written[]> {
    return this.persistence.retryPending();
  }

  takePending(file: string): (result: WriteResult) => void {
    return this.queuedSaves.take(file);
  }

  idle(file: string): Promise<void> {
    return this.autosave.idle(file);
  }

  dispose(): void {
    this.autosave.dispose();
    this.queuedSaves.dispose();
  }

  private nameOfFile(file: string): string {
    const song = this.options.songs.all().find(stored => stored.file === file);
    const named = [
      ...this.options.services.all(),
      ...this.options.templates.all(),
    ].find(stored => stored.file === file);
    const name = song?.data.title ?? named?.data.name ?? '';
    return name.trim() === '' ? basename(file) : name;
  }

  savesFull(files: readonly string[]): EditResult | null {
    if (this.persistence.admits(files)) return null;
    // NOTE(0913vision): The operator may have closed 저장할 수 없음, so a
    // refusal shows it again with the files that wait.
    this.persistence.remind();
    return refuse('saves-full', 'Too many files are waiting to be saved');
  }

  saveLater<T extends {readonly id: string}>(
    kind: Kind<T>,
    documents: DocumentCollection<T>,
    id: string,
  ): void {
    this.saveSoon(kind, documents, id).catch((error: unknown) =>
      this.options.log.error('could not save a queued document', {id, error}),
    );
  }

  saveSoon<T extends {readonly id: string}>(
    kind: Kind<T>,
    documents: DocumentCollection<T>,
    id: string,
  ): Promise<Written> {
    const stored = documents.get(id);
    if (stored === undefined) {
      return Promise.resolve({file: '', result: {ok: true, value: undefined}});
    }
    return this.queuedSaves
      .schedule(stored.file, async () => {
        const latest = documents.get(id);
        if (latest === undefined) {
          return {ok: true, value: undefined};
        }
        return (await this.write(kind, latest)).result;
      })
      .then(result => ({file: stored.file, result}));
  }

  async write<T extends {readonly id: string}>(
    kind: Kind<T>,
    stored: StoredDocument<T>,
  ): Promise<Written> {
    const {file} = stored;
    const text = kind.serialize(stored.data, file);
    const result: WriteResult = text.ok
      ? await this.persistence.write({
          target: targetOf(kind, stored),
          text: text.value,
        })
      : {ok: false, error: {file, message: text.error.message}};
    if (!text.ok) {
      this.options.log.warn('could not serialize a content file', text.error);
    }
    return {file, result};
  }

  async remove<T extends {readonly id: string}>(
    kind: Kind<T>,
    stored: StoredDocument<T>,
  ): Promise<Written> {
    const result = await this.persistence.remove(targetOf(kind, stored));
    return {file: stored.file, result};
  }
}

/**
 * Composes the existing autosave, queued saves and persistence for one store.
 * It does not own the facade's edit queue or change when the facade flushes.
 */
export function createContentWrites(
  options: ContentWriteOptions,
): ContentWritePort {
  return new ContentWrites(options);
}

/** Checks existence and write access without changing or saving a document. */
export function checkEditable<T>(
  stored: StoredDocument<T> | undefined,
): Checked<T> {
  if (stored === undefined) {
    return {ok: false, error: refuse('not-found', 'No document has this id')};
  }
  if (stored.access === 'readOnly') {
    return {
      ok: false,
      error: refuse('read-only', 'A newer app version wrote this file'),
    };
  }
  return {ok: true, value: stored};
}

/**
 * Checks access, revision and schema compatibility without applying or saving
 * an update.
 */
export function checkUpdate<T extends {readonly schemaVersion: number}>(
  stored: StoredDocument<T> | undefined,
  baseRevision: number,
  update: T,
): Checked<T> {
  const checked = checkEditable(stored);
  if (checked.ok && checked.value.revision !== baseRevision) {
    const message = `The document is at revision ${checked.value.revision}, not ${baseRevision}`;
    return {ok: false, error: refuse('stale', message)};
  }
  if (checked.ok && checked.value.data.schemaVersion !== update.schemaVersion) {
    return {
      ok: false,
      error: refuse('invalid', 'An edit cannot change the schema version'),
    };
  }
  return checked;
}

/** Builds an edit refusal without logging, changing state or writing files. */
export function refuse(reason: EditRefusalReason, message: string): EditResult {
  return {ok: false, error: {reason, message}};
}

/**
 * Combines the applied edit and ordered file results without retrying or
 * changing them.
 */
export function answer(
  applied: EditSuccess,
  written: readonly Written[],
): EditResult {
  const unchanged = written.filter(({result}) => !result.ok);
  const [first] = unchanged;
  if (first === undefined) {
    return {ok: true, value: applied};
  }
  return {
    ok: false,
    error: {
      reason: 'write-failed',
      message: first.result.ok ? '' : first.result.error.message,
      applied,
      unchangedFiles: unchanged.map(({file}) => file),
    },
  };
}

function targetOf<T extends {readonly id: string}>(
  kind: Kind<T>,
  {file, data}: StoredDocument<T>,
): RecoveryTarget {
  return {file, kind: kind.name, id: data.id};
}
