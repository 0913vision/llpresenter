import type {Result} from '@core/common/result';
import type {
  LibrarySong,
  ServiceChange,
  ServiceEntry,
  SongChange,
  SongDocument,
  TemplateChange,
  TemplateEntry,
} from '@core/schema/contentDocuments';
import type {
  ContentEdit,
  EditRefusalReason,
  EditResult,
  EditSuccess,
} from '@core/schema/contentEdit';
import type {FileError} from '@core/schema/fileFormat';
import type {GroupedSong} from '@core/schema/groupedSong';
import type {ServiceId, SongId, TemplateId} from '@core/schema/ids';
import type {Service, Template} from '@core/schema/service';
import type {DocumentCollection, StoredDocument} from './documents';
import type {WriteResult} from './fileWriter';
import type {DataLocations} from './locations';
import type {SettingsStore} from './settingsStore';

/** Announces document and list changes; it does not persist or own listeners. */
export interface ContentEvents {
  readonly songChanged: (change: SongChange) => void;
  readonly songsListChanged: (songs: readonly LibrarySong[]) => void;
  readonly serviceChanged: (change: ServiceChange) => void;
  readonly servicesListChanged: (services: readonly ServiceEntry[]) => void;
  readonly templateChanged: (change: TemplateChange) => void;
  readonly templatesListChanged: (templates: readonly TemplateEntry[]) => void;
}

/** Describes one document codec without choosing a file or writing it. */
export interface Kind<T> {
  readonly name: 'song' | 'service' | 'template';
  readonly serialize: (data: T, file: string) => Result<string, FileError>;
}

/** Records one attempted file operation, independently of its applied edit. */
export interface Written {
  readonly file: string;
  readonly result: WriteResult;
}

/** A checked in-memory document or an edit refusal, without a disk operation. */
export type Checked<T> = Result<StoredDocument<T>, EditResult>;

/** Preserves the command discriminator and its payload without runtime parsing. */
export type ContentCommand<
  K extends ContentEdit['type'] = ContentEdit['type'],
> = {
  [P in K]: Extract<ContentEdit, {type: P}>;
}[K];

/** Requires a typed handler for every wire command; it does not serialize them. */
export type ContentHandlers = {
  readonly [K in ContentEdit['type']]: (
    edit: ContentCommand<K>,
  ) => EditResult | Promise<EditResult>;
};

/**
 * Borrows the store's live collections, write and announcement ports. Command
 * families never own a second edit queue, persistence instance, or state copy.
 */
export interface ContentCommandContext {
  readonly songs: DocumentCollection<GroupedSong>;
  readonly services: DocumentCollection<Service>;
  readonly templates: DocumentCollection<Template>;
  readonly locations: DataLocations;
  readonly settings: SettingsStore | null | undefined;
  readonly events: ContentEvents;
  readonly kinds: {
    readonly song: Kind<GroupedSong>;
    readonly service: Kind<Service>;
    readonly template: Kind<Template>;
  };
  readonly flushAutosave: () => Promise<void>;
  readonly newId: () => string;
  readonly now: () => string;
  readonly currentServiceId: () => string | null;
  readonly song: (id: string) => SongDocument | null;
  readonly songList: () => readonly LibrarySong[];
  readonly savesFull: (files: readonly string[]) => EditResult | null;
  readonly write: <T extends {readonly id: string}>(
    kind: Kind<T>,
    stored: StoredDocument<T>,
  ) => Promise<Written>;
  readonly remove: <T extends {readonly id: string}>(
    kind: Kind<T>,
    stored: StoredDocument<T>,
  ) => Promise<Written>;
  readonly saveLater: <T extends {readonly id: string}>(
    kind: Kind<T>,
    documents: DocumentCollection<T>,
    id: string,
  ) => void;
  readonly saveSoon: <T extends {readonly id: string}>(
    kind: Kind<T>,
    documents: DocumentCollection<T>,
    id: string,
  ) => Promise<Written>;
  readonly announceSong: (id: SongId) => void;
  readonly announceSongDocument: (id: SongId) => void;
  readonly announceService: (id: ServiceId) => void;
  readonly announceTemplate: (id: TemplateId) => void;
  readonly announceList: <T>(
    name: string,
    value: readonly T[],
    send: (value: readonly T[]) => void,
  ) => void;
  readonly checkEditable: <T>(
    stored: StoredDocument<T> | undefined,
  ) => Checked<T>;
  readonly checkUpdate: <T extends {readonly schemaVersion: number}>(
    stored: StoredDocument<T> | undefined,
    baseRevision: number,
    update: T,
  ) => Checked<T>;
  readonly refuse: (reason: EditRefusalReason, message: string) => EditResult;
  readonly answer: (
    applied: EditSuccess,
    written: readonly Written[],
  ) => EditResult;
}
