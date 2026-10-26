import {randomUUID} from 'node:crypto';
import {basename, join} from 'node:path';
import type {Result} from '@shared/result';
import type {
  LibrarySong,
  ServiceChange,
  ServiceEntry,
  SongChange,
  TemplateChange,
  TemplateEntry,
} from '@shared/schema/contentDocuments';
import type {
  ContentEdit,
  EditRefusalReason,
  EditResult,
  EditSuccess,
} from '@shared/schema/contentEdit';
import type {FileError} from '@shared/schema/fileFormat';
import {
  createServiceId,
  createSongId,
  createTemplateId,
  type ServiceId,
  type SongId,
  type TemplateId,
} from '@shared/schema/ids';
import {
  serializeService,
  serializeTemplate,
  type Service,
  type ServiceItem,
  type Template,
} from '@shared/schema/service';
import {serializeSong, type Song} from '@shared/schema/song';
import {
  parseSettingsEdit,
  type LabelRename,
} from '@shared/schema/settingsDocuments';
import type {SettingsStore} from './settingsStore';
import type {Logger} from '../log';
import {Autosave} from './autosave';
import {
  copiedItems,
  freeTitle,
  normalizeSongTitle,
  pickedItems,
  withArrangementPicks,
  withoutArrangement,
  withRenamedArrangement,
  type ArrangementPick,
} from './contentEdits';
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

const SCHEMA_VERSION = 1;
const NEW_SONG_TITLE = '새 곡';
const SONG_EXTENSION = '.llsong';
const SERVICE_EXTENSION = '.llservice';
const TIME_OF_DATE = /T(\d{2}:\d{2})$/;

export type {DocumentFiles} from './contentPersistence';

/** Where the content store tells windows about changes. */
export interface ContentEvents {
  readonly songChanged: (change: SongChange) => void;
  readonly songsListChanged: (songs: readonly LibrarySong[]) => void;
  readonly serviceChanged: (change: ServiceChange) => void;
  readonly servicesListChanged: (services: readonly ServiceEntry[]) => void;
  readonly templateChanged: (change: TemplateChange) => void;
  readonly templatesListChanged: (templates: readonly TemplateEntry[]) => void;
}

export interface ContentStoreOptions {
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

interface Kind<T> {
  readonly name: 'song' | 'service' | 'template';
  readonly serialize: (data: T, file: string) => Result<string, FileError>;
}

const SONG: Kind<Song> = {name: 'song', serialize: serializeSong};
const SERVICE: Kind<Service> = {name: 'service', serialize: serializeService};
const TEMPLATE: Kind<Template> = {
  name: 'template',
  serialize: serializeTemplate,
};

interface Written {
  readonly file: string;
  readonly result: WriteResult;
}

type Checked<T> = Result<StoredDocument<T>, EditResult>;

/**
 * The songs, 예배 순서, and 틀 in the main process, and the edits windows ask
 * for. A whole-document update applies over the stored file, so unknown
 * fields survive, and is saved half a second after the last change. An edit
 * that creates, deletes, or touches several files writes them at once, the
 * document it names first, then 예배 순서 and 틀, each in id order. A failed
 * write keeps the edit in memory and is answered with the files that didn't
 * change. Every change goes to the windows with its revision.
 */
export class ContentStore {
  private readonly songs: DocumentCollection<Song>;
  private readonly services: DocumentCollection<Service>;
  private readonly templates: DocumentCollection<Template>;
  private readonly autosave: Autosave;
  private readonly persistence: ContentPersistence;
  private readonly queuedSaves: QueuedSaves;
  private editing: Promise<void> = Promise.resolve();
  private readonly lastLists = new Map<string, string>();
  private currentServiceId: string | null;

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
  }

  /** Applies an edit and answers how it went. Never throws. */
  apply(edit: ContentEdit): Promise<EditResult> {
    return this.enqueue(() => this.applyEdit(edit));
  }

  /** Renames an app-wide label and every matching slide, saving settings before songs in ID order. */
  renameLabel(settings: SettingsStore, edit: LabelRename): Promise<EditResult> {
    return this.serial(() => this.prepareLabelRename(settings, edit))
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

  private async prepareLabelRename(
    settings: SettingsStore,
    edit: LabelRename,
  ): Promise<EditResult | {readonly saved: Promise<EditResult>}> {
    await this.autosave.flush();
    const current = settings.get('labels');
    if (current.name !== 'labels') {
      return refuse('not-found', 'The label list is unavailable');
    }
    if (current.access === 'readOnly') {
      return refuse('read-only', 'A newer app version wrote the label list');
    }
    if (current.revision !== edit.baseRevision) {
      return refuse(
        'stale',
        `The label list is at revision ${current.revision}`,
      );
    }
    if (!current.value.labels.some(label => label.name === edit.from)) {
      return refuse('not-found', 'The label no longer exists');
    }
    if (current.value.labels.some(label => label.name === edit.to)) {
      return refuse('invalid', 'Another label already has this name');
    }
    const affected = this.songs
      .all()
      .filter(song => song.data.slides.some(slide => slide.label === edit.from))
      .sort((a, b) => a.data.id.localeCompare(b.data.id));
    if (affected.some(song => song.access === 'readOnly')) {
      return refuse('read-only', 'A newer app version wrote an affected song');
    }
    const full = this.savesFull(affected.map(song => song.file));
    if (full !== null) return full;
    const update = parseSettingsEdit({
      type: 'settings.update',
      name: 'labels',
      baseRevision: current.revision,
      value: {
        ...current.value,
        labels: current.value.labels.map(label =>
          label.name === edit.from ? {...label, name: edit.to} : label,
        ),
      },
    });
    if (!update.ok) return refuse('invalid', update.error.message);
    const savedLabels = settings.apply(update.value);
    const next = settings.get('labels');
    if (next.revision === current.revision) return savedLabels;
    const changed = affected.map(song =>
      this.songs.replace(song, {
        ...song.data,
        slides: song.data.slides.map(slide =>
          slide.label === edit.from ? {...slide, label: edit.to} : slide,
        ),
      }),
    );
    for (const song of changed) this.announceSongDocument(song.data.id);
    await settings.savePending();
    const labelResult = await savedLabels;
    const saves = changed.map(song =>
      this.saveSoon(SONG, this.songs, song.data.id),
    );
    return {
      saved: Promise.all(saves).then(written => {
        const songsResult = answer(
          {id: 'labels', revision: next.revision},
          written,
        );
        if (labelResult.ok) return songsResult;
        if (labelResult.error.reason !== 'write-failed') return labelResult;
        return {
          ok: false,
          error: {
            ...labelResult.error,
            unchangedFiles: [
              ...labelResult.error.unchangedFiles,
              ...(songsResult.ok || songsResult.error.reason !== 'write-failed'
                ? []
                : songsResult.error.unchangedFiles),
            ],
          },
        };
      }),
    };
  }

  private async applyEdit(edit: ContentEdit): Promise<EditResult> {
    switch (edit.type) {
      case 'song.create':
        return this.createSong();
      case 'song.update':
        return this.updateSong(edit.song, edit.baseRevision);
      case 'song.delete':
        return this.deleteSong(edit.songId);
      case 'song.arrangement.rename':
        return this.changeArrangement(edit.songId, edit.from, edit.to);
      case 'song.arrangement.delete':
        return this.changeArrangement(edit.songId, edit.name, null);
      case 'service.create':
        return this.createService(edit);
      case 'service.update':
        return this.updateService(edit.service, edit.baseRevision);
      case 'service.delete':
        return this.deleteService(edit.serviceId);
      case 'service.importItems':
        return this.importItems(edit);
      case 'service.saveAsTemplate':
        return this.saveAsTemplate(edit.serviceId, edit.name);
      case 'template.update':
        return this.updateTemplate(edit.template, edit.baseRevision);
      case 'template.delete':
        return this.deleteTemplate(edit.templateId);
    }
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
  storedSongs(): ReadonlyMap<string, StoredDocument<Song>> {
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

  private async createSong(): Promise<EditResult> {
    const id = createSongId(randomUUID());
    const titles = new Set(
      this.songs.all().map(({data}) => normalizeSongTitle(data.title)),
    );
    const song: Song = {
      format: 'llsong',
      schemaVersion: SCHEMA_VERSION,
      id,
      title: freeTitle(NEW_SONG_TITLE, titles),
      slides: [{lines: []}],
    };
    const file = join(this.options.locations.songs, `${id}${SONG_EXTENSION}`);
    const full = this.savesFull([file]);
    if (full !== null) return full;
    const stored = this.songs.add(song, file);
    const written = await this.write(SONG, stored);
    this.announceSong(id);
    return answer({id, revision: stored.revision}, [written]);
  }

  private updateSong(song: Song, baseRevision: number): EditResult {
    const checked = checkUpdate(this.songs.get(song.id), baseRevision, song);
    if (!checked.ok) {
      return checked.error;
    }
    const title = normalizeSongTitle(song.title);
    if (title === '') {
      return refuse('invalid', 'The song title must not be blank');
    }
    if (this.hasOtherSongTitled(title, song.id)) {
      return refuse('duplicate-title', `Another song is titled ${title}`);
    }
    const full = this.savesFull([checked.value.file]);
    if (full !== null) return full;
    const {
      background: _background,
      arrangements: _arrangements,
      updatedAt: _updatedAt,
      ...kept
    } = checked.value.data;
    const stored = this.songs.replace(checked.value, {...kept, ...song, title});
    this.saveLater(SONG, this.songs, song.id);
    this.options.events.songChanged({
      songId: song.id,
      document: this.song(song.id),
    });
    if (
      checked.value.data.title !== title ||
      checked.value.data.slides.length !== song.slides.length
    ) {
      this.announceList(
        'songs',
        this.songList(),
        this.options.events.songsListChanged,
      );
    }
    return {ok: true, value: {id: song.id, revision: stored.revision}};
  }

  private async deleteSong(songId: SongId): Promise<EditResult> {
    const checked = checkEditable(this.songs.get(songId));
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.savesFull([checked.value.file]);
    if (full !== null) return full;
    this.songs.remove(songId);
    const written = await this.remove(SONG, checked.value);
    this.announceSong(songId);
    return answer({id: songId, revision: null}, [written]);
  }

  private async changeArrangement(
    songId: SongId,
    from: string,
    to: string | null,
  ): Promise<EditResult> {
    const checked = checkEditable(this.songs.get(songId));
    if (!checked.ok) {
      return checked.error;
    }
    const song = checked.value.data;
    if (to !== null && song.arrangements?.some(({name}) => name === to)) {
      return refuse('invalid', `The song already has a 구성 named ${to}`);
    }
    const changed =
      to === null
        ? withoutArrangement(song, from)
        : withRenamedArrangement(song, from, to);
    if (changed === null) {
      return refuse('not-found', `The song has no 구성 named ${from}`);
    }
    return this.rewriteArrangement(checked.value, changed, {songId, from, to});
  }

  private async rewriteArrangement(
    current: StoredDocument<Song>,
    changed: Song,
    pick: ArrangementPick,
  ): Promise<EditResult> {
    const servicePicks = picksToRewrite(this.services, pick);
    const templatePicks = picksToRewrite(this.templates, pick);
    const full = this.savesFull([
      current.file,
      ...servicePicks.map(({document}) => document.file),
      ...templatePicks.map(({document}) => document.file),
    ]);
    if (full !== null) return full;
    const stored = this.songs.replace(current, changed);
    const services = rewritePicks(this.services, servicePicks);
    const templates = rewritePicks(this.templates, templatePicks);
    this.announceSong(pick.songId);
    for (const service of services) {
      this.announceService(service.data.id);
    }
    for (const template of templates) {
      this.announceTemplate(template.data.id);
    }
    const written = [await this.write(SONG, stored)];
    for (const service of services) {
      written.push(await this.write(SERVICE, service));
    }
    for (const template of templates) {
      written.push(await this.write(TEMPLATE, template));
    }
    return answer({id: pick.songId, revision: stored.revision}, written);
  }

  private async createService({
    name,
    date,
    templateId,
  }: Extract<ContentEdit, {type: 'service.create'}>): Promise<EditResult> {
    const template =
      templateId === null ? null : this.templates.get(templateId);
    if (template === undefined) {
      return refuse('not-found', `No 틀 has the id ${String(templateId)}`);
    }
    const id = createServiceId(randomUUID());
    const service: Service = {
      format: 'llservice',
      schemaVersion: SCHEMA_VERSION,
      id,
      name,
      date,
      order: template === null ? [] : copiedItems(template.data.order),
    };
    const file = join(
      this.options.locations.services,
      `${id}${SERVICE_EXTENSION}`,
    );
    const full = this.savesFull([file]);
    if (full !== null) return full;
    const stored = this.services.add(service, file);
    const written = await this.write(SERVICE, stored);
    this.announceService(id);
    return answer({id, revision: stored.revision}, [written]);
  }

  private updateService(service: Service, baseRevision: number): EditResult {
    const checked = checkUpdate(
      this.services.get(service.id),
      baseRevision,
      service,
    );
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.savesFull([checked.value.file]);
    if (full !== null) return full;
    const stored = this.services.replace(checked.value, {
      ...checked.value.data,
      ...service,
    });
    this.saveLater(SERVICE, this.services, service.id);
    this.announceService(service.id);
    return {ok: true, value: {id: service.id, revision: stored.revision}};
  }

  private async deleteService(serviceId: ServiceId): Promise<EditResult> {
    if (serviceId === this.currentServiceId) {
      return refuse('invalid', 'The open 예배 순서 cannot be deleted');
    }
    const checked = checkEditable(this.services.get(serviceId));
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.savesFull([checked.value.file]);
    if (full !== null) return full;
    this.services.remove(serviceId);
    const written = await this.remove(SERVICE, checked.value);
    this.announceService(serviceId);
    return answer({id: serviceId, revision: null}, [written]);
  }

  private async importItems({
    serviceId,
    from,
    itemIds,
  }: Extract<ContentEdit, {type: 'service.importItems'}>): Promise<EditResult> {
    const checked = checkEditable(this.services.get(serviceId));
    if (!checked.ok) {
      return checked.error;
    }
    const source =
      from.kind === 'service'
        ? this.services.get(from.id)
        : this.templates.get(from.id);
    if (source === undefined) {
      return refuse('not-found', `No ${from.kind} has the id ${from.id}`);
    }
    const wanted = new Set<string>(itemIds);
    if (
      source.data.order.filter(({id}) => wanted.has(id)).length !== wanted.size
    ) {
      return refuse('invalid', 'An item to import is not in the source');
    }
    const picked = pickedItems(source.data.order, wanted);
    const target = checked.value;
    const full = this.savesFull([target.file]);
    if (full !== null) return full;
    const stored = this.services.replace(target, {
      ...target.data,
      order: [...target.data.order, ...copiedItems(picked)],
    });
    const written = await this.write(SERVICE, stored);
    this.announceService(serviceId);
    return answer({id: serviceId, revision: stored.revision}, [written]);
  }

  private async saveAsTemplate(
    serviceId: ServiceId,
    name: string,
  ): Promise<EditResult> {
    const service = this.services.get(serviceId);
    if (service === undefined) {
      return refuse('not-found', `No 예배 순서 has the id ${serviceId}`);
    }
    const id = createTemplateId(randomUUID());
    const time = TIME_OF_DATE.exec(service.data.date)?.[1];
    const template: Template = {
      format: 'llservice',
      schemaVersion: SCHEMA_VERSION,
      id,
      name,
      ...(time === undefined ? {} : {time}),
      order: copiedItems(service.data.order),
    };
    const file = join(
      this.options.locations.templates,
      `${id}${SERVICE_EXTENSION}`,
    );
    const full = this.savesFull([file]);
    if (full !== null) return full;
    const stored = this.templates.add(template, file);
    const written = await this.write(TEMPLATE, stored);
    this.announceTemplate(id);
    return answer({id, revision: stored.revision}, [written]);
  }

  private updateTemplate(template: Template, baseRevision: number): EditResult {
    const checked = checkUpdate(
      this.templates.get(template.id),
      baseRevision,
      template,
    );
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.savesFull([checked.value.file]);
    if (full !== null) return full;
    const {time: _time, ...kept} = checked.value.data;
    const stored = this.templates.replace(checked.value, {
      ...kept,
      ...template,
    });
    this.saveLater(TEMPLATE, this.templates, template.id);
    this.announceTemplate(template.id);
    return {ok: true, value: {id: template.id, revision: stored.revision}};
  }

  private async deleteTemplate(templateId: TemplateId): Promise<EditResult> {
    const checked = checkEditable(this.templates.get(templateId));
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.savesFull([checked.value.file]);
    if (full !== null) return full;
    this.templates.remove(templateId);
    const written = await this.remove(TEMPLATE, checked.value);
    this.announceTemplate(templateId);
    return answer({id: templateId, revision: null}, [written]);
  }

  /**
   * The refusal for an edit of files that don't wait yet while too many wait
   * to be saved, which shows 저장할 수 없음 again; null when it may go on.
   */
  private savesFull(files: readonly string[]): EditResult | null {
    if (this.persistence.admits(files)) return null;
    this.persistence.remind();
    return refuse('saves-full', 'Too many files are waiting to be saved');
  }

  private hasOtherSongTitled(title: string, songId: string): boolean {
    return this.songs
      .all()
      .some(
        ({data}) =>
          data.id !== songId && normalizeSongTitle(data.title) === title,
      );
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

interface PickRewrite<T> {
  readonly document: StoredDocument<T>;
  readonly order: readonly ServiceItem[];
}

function picksToRewrite<
  T extends {readonly id: string; readonly order: readonly ServiceItem[]},
>(
  documents: DocumentCollection<T>,
  pick: ArrangementPick,
): ReadonlyArray<PickRewrite<T>> {
  return documents
    .all()
    .filter(({access}) => access === 'editable')
    .flatMap(document => {
      const order = withArrangementPicks(document.data.order, pick);
      return order === null ? [] : [{document, order}];
    })
    .sort((a, b) => a.document.data.id.localeCompare(b.document.data.id));
}

function rewritePicks<
  T extends {readonly id: string; readonly order: readonly ServiceItem[]},
>(
  documents: DocumentCollection<T>,
  rewrites: ReadonlyArray<PickRewrite<T>>,
): ReadonlyArray<StoredDocument<T>> {
  return rewrites.map(({document, order}) =>
    documents.replace(document, {...document.data, order}),
  );
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
