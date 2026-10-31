import {randomUUID} from 'node:crypto';
import {basename} from 'node:path';
import type {
  LibrarySong,
  ServiceEntry,
  TemplateEntry,
} from '@core/schema/contentDocuments';
import type {
  ContentEdit,
  EditRefusalReason,
  EditResult,
  EditSuccess,
} from '@core/schema/contentEdit';
import {type ServiceId, type SongId, type TemplateId} from '@core/schema/ids';
import {
  serializeService,
  serializeTemplate,
  type Service,
  type Template,
} from '@core/schema/service';
import {serializeGroupedSong, type GroupedSong} from '@core/schema/groupedSong';
import type {LabelRename} from '@core/schema/settingsDocuments';
import type {SettingsStore} from './settingsStore';
import type {Logger} from '../log';
import {Autosave} from './autosave';
import {
  librarySongs,
  serviceDocument,
  serviceEntries,
  songDocument,
  templateDocument,
  templateEntries,
} from './contentLists';
import {ContentPersistence, type DocumentFiles} from './contentPersistence';
import {DocumentCollection, type StoredDocument} from './documents';
import type {WriteResult} from './fileWriter';
import type {StoredFile} from './library';
import type {DataLocations} from './locations';
import type {RecoveryTarget} from './recoveryCopies';
import {QueuedSaves} from './queuedSaves';
import type {
  Checked,
  ContentCommand,
  ContentCommandContext,
  ContentEvents,
  ContentHandlers,
  Kind,
  Written,
} from './contentCommands';
import {createSongContentCommands} from './contentSongCommands';
import {createServiceContentCommands} from './contentServiceCommands';
import {prepareLabelRename} from './labelRenameTransaction';
export type {ContentEvents} from './contentCommands';

export type {DocumentFiles} from './contentPersistence';

export interface ContentStoreOptions {
  readonly settings?: SettingsStore | null;
  readonly locations: DataLocations;
  readonly songs: ReadonlyMap<string, StoredFile<GroupedSong>>;
  readonly services: ReadonlyMap<string, StoredFile<Service>>;
  readonly templates: ReadonlyMap<string, StoredFile<Template>>;
  readonly files: DocumentFiles;
  readonly events: ContentEvents;
  readonly log: Logger;
  readonly writeDelayMs?: number;
  readonly openServiceId?: string | null;
}

const SONG: Kind<GroupedSong> = {name: 'song', serialize: serializeGroupedSong};
const SERVICE: Kind<Service> = {name: 'service', serialize: serializeService};
const TEMPLATE: Kind<Template> = {
  name: 'template',
  serialize: serializeTemplate,
};

/**
 * The songs, 예배 순서, and 템플릿 in the main process, and the edits windows ask
 * for. A whole-document update applies over the stored file, so unknown
 * fields survive, and is saved half a second after the last change. An edit
 * that creates, deletes, or touches several files writes them at once, the
 * document it names first, then 예배 순서 and 템플릿, each in id order. A failed
 * write keeps the edit in memory and is answered with the files that didn't
 * change. Every change goes to the windows with its revision.
 */
export class ContentStore {
  private readonly songs: DocumentCollection<GroupedSong>;
  private readonly services: DocumentCollection<Service>;
  private readonly templates: DocumentCollection<Template>;
  private readonly autosave: Autosave;
  private readonly persistence: ContentPersistence;
  private readonly queuedSaves: QueuedSaves;
  private editing: Promise<void> = Promise.resolve();
  private readonly lastLists = new Map<string, string>();
  private currentServiceId: string | null;
  private readonly commandContext: ContentCommandContext;
  private readonly commands: Omit<ContentHandlers, 'saves.retry'>;

  constructor(private readonly options: ContentStoreOptions) {
    this.currentServiceId = options.openServiceId ?? null;
    this.songs = new DocumentCollection(options.songs);
    this.services = new DocumentCollection(options.services);
    this.templates = new DocumentCollection(options.templates);
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
    this.lastLists.set('songs', JSON.stringify(this.songList()));
    this.lastLists.set('services', JSON.stringify(this.serviceList()));
    this.lastLists.set('templates', JSON.stringify(this.templateList()));

    this.commandContext = {
      songs: this.songs,
      services: this.services,
      templates: this.templates,
      locations: options.locations,
      settings: options.settings,
      events: options.events,
      kinds: {song: SONG, service: SERVICE, template: TEMPLATE},
      flushAutosave: () => this.autosave.flush(),
      newId: () => randomUUID(),
      now: () => new Date().toISOString(),
      currentServiceId: () => this.currentServiceId,
      song: id => this.song(id),
      songList: () => this.songList(),
      savesFull: files => this.savesFull(files),
      write: (kind, stored) => this.write(kind, stored),
      remove: (kind, stored) => this.remove(kind, stored),
      saveLater: (kind, documents, id) => this.saveLater(kind, documents, id),
      saveSoon: (kind, documents, id) => this.saveSoon(kind, documents, id),
      announceSong: id => this.announceSong(id),
      announceSongDocument: id => this.announceSongDocument(id),
      announceService: id => this.announceService(id),
      announceTemplate: id => this.announceTemplate(id),
      announceList: (name, value, send) => this.announceList(name, value, send),
      checkEditable,
      checkUpdate,
      refuse,
      answer,
    };
    this.commands = {
      ...createSongContentCommands(this.commandContext),
      ...createServiceContentCommands(this.commandContext),
    };
  }

  /** Applies an edit and answers how it went. Never throws. */
  apply(edit: ContentEdit): Promise<EditResult> {
    return this.enqueue(() => this.applyEdit(edit));
  }

  /** Renames an app-wide label and matching groups, saving settings before songs. */
  renameLabel(settings: SettingsStore, edit: LabelRename): Promise<EditResult> {
    return this.serial(() =>
      prepareLabelRename(this.commandContext, settings, edit),
    )
      .then(prepared => ('saved' in prepared ? prepared.saved : prepared))
      .catch((error: unknown) => this.editFailure(error));
  }

  get openServiceId(): string | null {
    return this.currentServiceId;
  }

  /** Saves the current service before switching, publishing its projection through the callback. */
  openService(
    serviceId: ServiceId,
    publishCurrent: () => Promise<void>,
  ): Promise<EditResult> {
    return this.enqueue(async () => {
      const target = this.services.get(serviceId);
      if (target === undefined) {
        return refuse('not-found', 'No service has this id');
      }
      const pendingFile =
        this.currentServiceId === null
          ? undefined
          : this.services.get(this.currentServiceId)?.file;
      const finish =
        pendingFile === undefined
          ? () => undefined
          : this.queuedSaves.take(pendingFile);
      if (pendingFile !== undefined) await this.autosave.idle(pendingFile);
      const current =
        this.currentServiceId === null
          ? undefined
          : this.services.get(this.currentServiceId);
      if (current !== undefined) {
        if (current.access === 'editable') {
          const saved = await this.write(SERVICE, current);
          finish(saved.result);
          if (!saved.result.ok) {
            return answer({id: current.data.id, revision: current.revision}, [
              saved,
            ]);
          }
        } else finish({ok: true, value: undefined});
        this.announceService(current.data.id);
        await publishCurrent();
      }
      this.currentServiceId = serviceId;
      return {ok: true, value: {id: serviceId, revision: target.revision}};
    });
  }

  private enqueue(
    work: () => EditResult | Promise<EditResult>,
  ): Promise<EditResult> {
    return this.serial(work).catch((error: unknown) => this.editFailure(error));
  }

  private serial<T>(work: () => T | Promise<T>): Promise<T> {
    const applied = this.editing.then(work);
    this.editing = applied.then(
      () => undefined,
      () => undefined,
    );
    return applied;
  }

  private editFailure(error: unknown): EditResult {
    this.options.log.error('could not apply a content edit', error);
    return refuse(
      'invalid',
      error instanceof Error ? error.message : String(error),
    );
  }

  private async applyEdit(edit: ContentEdit): Promise<EditResult> {
    if (edit.type === 'saves.retry') {
      await this.autosave.flush();
      const settings = (await this.options.settings?.retryPending()) ?? [];
      const content = await this.persistence.retryPending();
      return answer({id: 'saves', revision: null}, [...settings, ...content]);
    }
    return this.applyDocumentEdit(edit);
  }

  private applyDocumentEdit<
    K extends Exclude<ContentEdit['type'], 'saves.retry'>,
  >(edit: ContentCommand<K>): EditResult | Promise<EditResult> {
    return this.commands[edit.type](edit);
  }

  songList(): readonly LibrarySong[] {
    return librarySongs(this.songs.all(), this.services.all());
  }

  serviceList(): readonly ServiceEntry[] {
    return serviceEntries(this.services.all());
  }

  templateList(): readonly TemplateEntry[] {
    return templateEntries(this.templates.all());
  }

  song(id: string) {
    const stored = this.songs.get(id);
    return stored === undefined ? null : songDocument(stored);
  }

  service(id: string) {
    const stored = this.services.get(id);
    return stored === undefined ? null : serviceDocument(stored);
  }

  template(id: string) {
    const stored = this.templates.get(id);
    return stored === undefined ? null : templateDocument(stored);
  }

  /** A 예배 순서 as it is now, for the open one in 진행. */
  storedService(id: string): StoredDocument<Service> | undefined {
    return this.services.get(id);
  }

  /** The current songs, for the open 예배 순서 in 진행. */
  storedSongs(): ReadonlyMap<string, StoredDocument<GroupedSong>> {
    return new Map(this.songs.all().map(song => [song.data.id, song]));
  }

  private nameOfFile(file: string): string {
    const song = this.songs.all().find(stored => stored.file === file);
    const named = [...this.services.all(), ...this.templates.all()].find(
      stored => stored.file === file,
    );
    const name = song?.data.title ?? named?.data.name ?? '';
    return name.trim() === '' ? basename(file) : name;
  }

  /** Saves every change that waits, for quitting. */
  async flush(): Promise<void> {
    await this.editing;
    await this.autosave.flush();
    await this.persistence.flush();
  }

  dispose(): void {
    this.autosave.dispose();
    this.queuedSaves.dispose();
  }

  private savesFull(files: readonly string[]): EditResult | null {
    if (this.persistence.admits(files)) return null;
    // NOTE(0913vision): The operator may have closed 저장할 수 없음, so a
    // refusal shows it again with the files that wait.
    this.persistence.remind();
    return refuse('saves-full', 'Too many files are waiting to be saved');
  }

  private saveLater<T extends {readonly id: string}>(
    kind: Kind<T>,
    documents: DocumentCollection<T>,
    id: string,
  ): void {
    this.saveSoon(kind, documents, id).catch((error: unknown) =>
      this.options.log.error('could not save a queued document', {id, error}),
    );
  }

  private saveSoon<T extends {readonly id: string}>(
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

  private async write<T extends {readonly id: string}>(
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

  private async remove<T extends {readonly id: string}>(
    kind: Kind<T>,
    stored: StoredDocument<T>,
  ): Promise<Written> {
    const result = await this.persistence.remove(targetOf(kind, stored));
    return {file: stored.file, result};
  }

  private announceSong(songId: SongId): void {
    this.announceSongDocument(songId);
    this.announceLists();
  }

  private announceSongDocument(songId: SongId): void {
    this.options.events.songChanged({songId, document: this.song(songId)});
  }

  private announceService(serviceId: ServiceId): void {
    this.options.events.serviceChanged({
      serviceId,
      document: this.service(serviceId),
    });
    this.announceLists();
  }

  private announceTemplate(templateId: TemplateId): void {
    this.options.events.templateChanged({
      templateId,
      document: this.template(templateId),
    });
    this.announceLists();
  }

  // NOTE(0913vision): The lists go out only when what they show changed, so
  // typing lyrics never re-renders the 라이브러리 or the 예배 순서 list.
  private announceLists(): void {
    this.announceList(
      'songs',
      this.songList(),
      this.options.events.songsListChanged,
    );
    this.announceList(
      'services',
      this.serviceList(),
      this.options.events.servicesListChanged,
    );
    this.announceList(
      'templates',
      this.templateList(),
      this.options.events.templatesListChanged,
    );
  }

  private announceList<T>(
    name: string,
    value: readonly T[],
    send: (value: readonly T[]) => void,
  ): void {
    const key = JSON.stringify(value);
    if (key !== this.lastLists.get(name)) {
      this.lastLists.set(name, key);
      send(value);
    }
  }
}

function checkEditable<T>(stored: StoredDocument<T> | undefined): Checked<T> {
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

function checkUpdate<T extends {readonly schemaVersion: number}>(
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

function refuse(reason: EditRefusalReason, message: string): EditResult {
  return {ok: false, error: {reason, message}};
}

function answer(applied: EditSuccess, written: readonly Written[]): EditResult {
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
