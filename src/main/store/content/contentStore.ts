import type {
  LibrarySong,
  ServiceEntry,
  TemplateEntry,
} from '@core/schema/services/contentDocuments';
import type {ContentEdit, EditResult} from '@core/schema/services/contentEdit';
import {serializeSong, type Song} from '@core/schema/songs/song';
import {type ServiceId} from '@core/schema/common/ids';
import {
  serializeService,
  serializeTemplate,
  type Service,
  type Template,
} from '@core/schema/services/service';
import type {LabelRename} from '@core/schema/app/settingsDocuments';
import {randomUUID} from 'node:crypto';
import {normalizeSongTitle} from '@core/songs';
import {dirname, extname, join} from 'node:path';
import type {Logger} from '../../base/log';
import {
  createContentAnnouncements,
  type ContentAnnouncements,
} from './contentAnnouncements';
import type {
  ContentCommand,
  ContentCommandContext,
  ContentEvents,
  ContentHandlers,
  Kind,
} from './contentCommands';
import {
  librarySongs,
  serviceDocument,
  serviceEntries,
  songDocument,
  templateDocument,
  templateEntries,
} from './contentLists';
import {type DocumentFiles} from './contentPersistence';
import {createServiceContentCommands} from './contentServiceCommands';
import {createSongContentCommands} from './contentSongCommands';
import {
  answer,
  checkEditable,
  checkUpdate,
  createContentWrites,
  refuse,
  type ContentWritePort,
} from './contentWriteCoordinator';
import {DocumentCollection, type StoredDocument} from '../files/documents';
import {prepareLabelRename} from '../settings/labelRenameTransaction';
import type {StoredFile} from '../files/library';
import type {DataLocations} from '../locations/locations';
import type {SettingsStore} from '../settings/settingsStore';

/**
 * What the content store starts from: the settings store, the data folders, the
 * songs, 예배 순서 and templates read at launch, and the writer of their files.
 */
export interface ContentStoreOptions {
  readonly settings?: SettingsStore | null;
  readonly locations: DataLocations;
  readonly songs: ReadonlyMap<string, StoredFile<Song>>;
  readonly services: ReadonlyMap<string, StoredFile<Service>>;
  readonly templates: ReadonlyMap<string, StoredFile<Template>>;
  readonly files: DocumentFiles;
  readonly events: ContentEvents;
  readonly log: Logger;
  readonly writeDelayMs?: number;
  readonly openServiceId?: string | null;
}

const SONG: Kind<Song> = {name: 'song', serialize: serializeSong};
const SERVICE: Kind<Service> = {name: 'service', serialize: serializeService};
const TEMPLATE: Kind<Template> = {
  name: 'template',
  serialize: serializeTemplate,
};

type DeleteArea = 'song' | 'service' | 'template';
interface DeleteStep {
  readonly id: string;
  undo(): Promise<EditResult>;
  redo(): Promise<EditResult>;
}
interface DeleteStack {
  undo: DeleteStep[];
  redo: DeleteStep[];
}

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
  private readonly songs: DocumentCollection<Song>;
  private readonly services: DocumentCollection<Service>;
  private readonly templates: DocumentCollection<Template>;
  private editing: Promise<void> = Promise.resolve();
  private currentServiceId: string | null;
  private readonly writes: ContentWritePort;
  private readonly announcements: ContentAnnouncements;
  private readonly commandContext: ContentCommandContext;
  private readonly commands: Omit<
    ContentHandlers,
    'saves.retry' | 'content.undoDelete' | 'content.redoDelete'
  >;
  private readonly deletions: Record<DeleteArea, DeleteStack> = {
    song: {undo: [], redo: []},
    service: {undo: [], redo: []},
    template: {undo: [], redo: []},
  };

  constructor(private readonly options: ContentStoreOptions) {
    this.currentServiceId = options.openServiceId ?? null;
    this.songs = new DocumentCollection(options.songs);
    this.services = new DocumentCollection(options.services);
    this.templates = new DocumentCollection(options.templates);
    this.writes = createContentWrites({
      songs: this.songs,
      services: this.services,
      templates: this.templates,
      files: options.files,
      log: options.log,
      writeDelayMs: options.writeDelayMs,
    });
    this.announcements = createContentAnnouncements(
      {
        song: id => this.song(id),
        service: id => this.service(id),
        template: id => this.template(id),
        songList: () => this.songList(),
        serviceList: () => this.serviceList(),
        templateList: () => this.templateList(),
      },
      options.events,
    );

    this.commandContext = {
      songs: this.songs,
      services: this.services,
      templates: this.templates,
      locations: options.locations,
      settings: options.settings,
      events: options.events,
      kinds: {song: SONG, service: SERVICE, template: TEMPLATE},
      flushAutosave: () => this.writes.flushAutosave(),
      newId: () => randomUUID(),
      now: () => new Date().toISOString(),
      currentServiceId: () => this.currentServiceId,
      song: id => this.song(id),
      songList: () => this.songList(),
      savesFull: files => this.writes.savesFull(files),
      write: (kind, stored) => this.writes.write(kind, stored),
      remove: (kind, stored) => this.writes.remove(kind, stored),
      saveLater: (kind, documents, id) =>
        this.writes.saveLater(kind, documents, id),
      saveSoon: (kind, documents, id) =>
        this.writes.saveSoon(kind, documents, id),
      announceSong: id => this.announcements.announceSong(id),
      announceSongDocument: id => this.announcements.announceSongDocument(id),
      announceService: id => this.announcements.announceService(id),
      announceTemplate: id => this.announcements.announceTemplate(id),
      announceList: (name, value, send) =>
        this.announcements.announceList(name, value, send),
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
          : this.writes.takePending(pendingFile);
      if (pendingFile !== undefined) await this.writes.idle(pendingFile);
      const current =
        this.currentServiceId === null
          ? undefined
          : this.services.get(this.currentServiceId);
      if (current !== undefined) {
        if (current.access === 'editable') {
          const saved = await this.writes.write(SERVICE, current);
          finish(saved.result);
          if (!saved.result.ok) {
            return answer({id: current.data.id, revision: current.revision}, [
              saved,
            ]);
          }
        } else finish({ok: true, value: undefined});
        this.announcements.announceService(current.data.id);
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
      await this.writes.flushAutosave();
      const settings = (await this.options.settings?.retryPending()) ?? [];
      const content = await this.writes.retryPending();
      return answer({id: 'saves', revision: null}, [...settings, ...content]);
    }
    if (
      edit.type === 'content.undoDelete' ||
      edit.type === 'content.redoDelete'
    ) {
      const undo = edit.type === 'content.undoDelete';
      const stack = this.deletions[edit.area];
      const from = undo ? stack.undo : stack.redo;
      const to = undo ? stack.redo : stack.undo;
      const step = from.at(-1);
      if (!step) return refuse('not-found', 'No deletion to restore');
      if (step.id !== edit.id) {
        return refuse('stale', 'Another document was deleted more recently');
      }
      const result = await (undo ? step.undo() : step.redo());
      if (result.ok || result.error.reason === 'write-failed') {
        from.pop();
        to.push(step);
      }
      return result;
    }
    const deletion = this.prepareDeletion(edit);
    const result = await this.applyDocumentEdit(edit);
    if (deletion && (result.ok || result.error.reason === 'write-failed')) {
      deletion.record(!result.ok);
    }
    return result;
  }

  private prepareDeletion(
    edit: Exclude<
      ContentEdit,
      {type: 'saves.retry' | 'content.undoDelete' | 'content.redoDelete'}
    >,
  ): {record: (failed: boolean) => void} | undefined {
    if (edit.type === 'song.delete') {
      return this.deletionStep({
        area: 'song',
        documents: this.songs,
        kind: SONG,
        id: edit.songId,
        announce: () => this.announcements.announceSong(edit.songId),
      });
    }
    if (edit.type === 'service.delete') {
      return this.deletionStep({
        area: 'service',
        documents: this.services,
        kind: SERVICE,
        id: edit.serviceId,
        announce: () => this.announcements.announceService(edit.serviceId),
      });
    }
    if (edit.type === 'template.delete') {
      return this.deletionStep({
        area: 'template',
        documents: this.templates,
        kind: TEMPLATE,
        id: edit.templateId,
        announce: () => this.announcements.announceTemplate(edit.templateId),
      });
    }
    return undefined;
  }

  private deletionStep<T extends {readonly id: string}>({
    area,
    documents,
    kind,
    id,
    announce,
  }: {
    area: DeleteArea;
    documents: DocumentCollection<T>;
    kind: Kind<T>;
    id: string;
    announce: () => void;
  }): {record: (failed: boolean) => void} | undefined {
    const original = documents.get(id);
    if (!original) return undefined;
    let saved: StoredDocument<T> = original;
    let deleteFailed = false;
    const step: DeleteStep = {
      id,
      undo: async () => {
        if (documents.get(id)) {
          return refuse('stale', 'The deleted document already exists');
        }
        if (area === 'song') {
          const title: unknown = Reflect.get(saved.data, 'title');
          if (
            typeof title !== 'string' ||
            this.songs
              .all()
              .some(
                song =>
                  normalizeSongTitle(song.data.title) ===
                  normalizeSongTitle(title),
              )
          ) {
            return refuse(
              'duplicate-title',
              'Another song already has this title',
            );
          }
        }
        const file = deleteFailed
          ? saved.file
          : join(dirname(saved.file), `${randomUUID()}${extname(saved.file)}`);
        const full = this.writes.savesFull([file]);
        if (full) return full;
        saved = documents.restore(saved, file);
        const written = await this.writes.write(kind, saved);
        announce();
        return answer({id, revision: saved.revision}, [written]);
      },
      redo: async () => {
        const current = documents.get(id);
        if (!current || current !== saved) {
          return refuse('stale', 'The restored document changed');
        }
        if (area === 'service' && id === this.currentServiceId) {
          return refuse('invalid', 'The open service cannot be deleted');
        }
        const full = this.writes.savesFull([current.file]);
        if (full) return full;
        documents.remove(id);
        const written = await this.writes.remove(kind, current);
        deleteFailed = !written.result.ok;
        announce();
        return answer({id, revision: null}, [written]);
      },
    };
    return {
      record: failed => {
        deleteFailed = failed;
        const stack = this.deletions[area];
        stack.undo.push(step);
        stack.redo = [];
      },
    };
  }

  private applyDocumentEdit<
    K extends Exclude<
      ContentEdit['type'],
      'saves.retry' | 'content.undoDelete' | 'content.redoDelete'
    >,
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

  /** Every 예배 순서 as it is now, for the places that use a media item. */
  storedServices(): ReadonlyArray<StoredDocument<Service>> {
    return this.services.all();
  }

  /** The current songs, for the open 예배 순서 in 진행. */
  storedSongs(): ReadonlyMap<string, StoredDocument<Song>> {
    return new Map(this.songs.all().map(song => [song.data.id, song]));
  }

  /** Saves every change that waits, for quitting. */
  async flush(): Promise<void> {
    await this.editing;
    await this.writes.flushAutosave();
    await this.writes.flushPersistence();
  }

  dispose(): void {
    this.writes.dispose();
  }
}
