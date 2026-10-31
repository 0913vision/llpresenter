import type {
  LibrarySong,
  ServiceEntry,
  TemplateEntry,
} from '@core/schema/contentDocuments';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import {serializeGroupedSong, type GroupedSong} from '@core/schema/groupedSong';
import {type ServiceId} from '@core/schema/ids';
import {
  serializeService,
  serializeTemplate,
  type Service,
  type Template,
} from '@core/schema/service';
import type {LabelRename} from '@core/schema/settingsDocuments';
import {randomUUID} from 'node:crypto';
import type {Logger} from '../log';
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
import {DocumentCollection, type StoredDocument} from './documents';
import {prepareLabelRename} from './labelRenameTransaction';
import type {StoredFile} from './library';
import type {DataLocations} from './locations';
import type {SettingsStore} from './settingsStore';
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
  private editing: Promise<void> = Promise.resolve();
  private currentServiceId: string | null;
  private readonly writes: ContentWritePort;
  private readonly announcements: ContentAnnouncements;
  private readonly commandContext: ContentCommandContext;
  private readonly commands: Omit<ContentHandlers, 'saves.retry'>;

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
