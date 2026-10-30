import {
  parseLibrarySongs,
  parseServiceChange,
  parseServiceDocument,
  parseServiceEntries,
  parseSongChange,
  parseSongDocument,
  parseTemplateChange,
  parseTemplateDocument,
  parseTemplateEntries,
  type LibrarySong,
  type ServiceChange,
  type ServiceDocument,
  type ServiceEntry,
  type SongChange,
  type SongDocument,
  type TemplateChange,
  type TemplateDocument,
  type TemplateEntry,
} from '@core/schema/contentDocuments';
import {
  parseContentEdit,
  parseEditResult,
  refuseInvalidEdit,
  type ContentEdit,
  type EditResult,
} from '@core/schema/contentEdit';
import {checkPart} from '@core/schema/fileFormat';
import {
  serviceIdSchema,
  songIdSchema,
  templateIdSchema,
} from '@core/schema/ids';
import {Channels} from './channels';
import {
  request,
  type IpcPort,
  type Parse,
  type PushEndpoint,
  type QueryEndpoint,
  type RequestEndpoint,
  type Unsubscribe,
} from './endpoint';

/** Reading and following one kind of document: songs, 예배 순서, or 템플릿. */
export interface DocumentApi<TEntry, TDocument, TChange> {
  /** The list, as the 라이브러리 or the 예배 순서 list shows it. */
  list(): Promise<readonly TEntry[]>;
  /** One document with its revision, or `null` when there is none. */
  get(id: string): Promise<TDocument | null>;
  /**
   * Calls the listener with the whole list whenever an entry is added,
   * removed, or changes what the list shows; typing lyrics doesn't change it.
   *
   * @returns A function that removes the listener. Always call it.
   */
  subscribeList(listener: (entries: readonly TEntry[]) => void): Unsubscribe;
  /**
   * Calls the listener once for every change the main process applies to a
   * document, with its new revision. While someone types, that is as often as
   * the editor sends its updates; a window that shows a document follows only
   * the one it shows and skips the change whose revision answered its own
   * edit.
   *
   * @returns A function that removes the listener. Always call it.
   */
  subscribe(listener: (change: TChange) => void): Unsubscribe;
}

/** The calls of one kind of document. */
export interface DocumentEndpoints<TEntry, TDocument, TChange> {
  readonly list: QueryEndpoint<readonly TEntry[]>;
  readonly listChanged: PushEndpoint<readonly TEntry[]>;
  readonly get: RequestEndpoint<string, TDocument | null>;
  readonly changed: PushEndpoint<TChange>;
}

interface DocumentKind<TEntry, TDocument, TChange> {
  readonly channels: {
    readonly list: string;
    readonly listChanged: string;
    readonly get: string;
    readonly changed: string;
  };
  readonly id: Parse<string>;
  readonly entries: Parse<readonly TEntry[]>;
  readonly document: Parse<TDocument | null>;
  readonly change: Parse<TChange>;
}

function documentEndpoints<TEntry, TDocument, TChange>(
  kind: DocumentKind<TEntry, TDocument, TChange>,
): DocumentEndpoints<TEntry, TDocument, TChange> {
  const {channels} = kind;
  return {
    list: {channel: channels.list, reply: kind.entries},
    listChanged: {channel: channels.listChanged, value: kind.entries},
    get: {
      channel: channels.get,
      request: kind.id,
      reply: kind.document,
      refuse: () => null,
    },
    changed: {channel: channels.changed, value: kind.change},
  };
}

/** The calls that edit and read songs, 예배 순서, and 템플릿. */
export const contentEndpoints = {
  edit: request<ContentEdit, EditResult>(Channels.contentEdit, {
    request: parseContentEdit,
    reply: parseEditResult,
    refuse: refuseInvalidEdit,
  }),
  songs: documentEndpoints<LibrarySong, SongDocument, SongChange>({
    channels: {
      list: Channels.songsList,
      listChanged: Channels.songsListChanged,
      get: Channels.songsDocumentGet,
      changed: Channels.songsDocumentChanged,
    },
    id: value => checkPart(songIdSchema, value),
    entries: parseLibrarySongs,
    document: parseSongDocument,
    change: parseSongChange,
  }),
  services: documentEndpoints<ServiceEntry, ServiceDocument, ServiceChange>({
    channels: {
      list: Channels.servicesList,
      listChanged: Channels.servicesListChanged,
      get: Channels.servicesDocumentGet,
      changed: Channels.servicesDocumentChanged,
    },
    id: value => checkPart(serviceIdSchema, value),
    entries: parseServiceEntries,
    document: parseServiceDocument,
    change: parseServiceChange,
  }),
  templates: documentEndpoints<TemplateEntry, TemplateDocument, TemplateChange>(
    {
      channels: {
        list: Channels.templatesList,
        listChanged: Channels.templatesListChanged,
        get: Channels.templatesDocumentGet,
        changed: Channels.templatesDocumentChanged,
      },
      id: value => checkPart(templateIdSchema, value),
      entries: parseTemplateEntries,
      document: parseTemplateDocument,
      change: parseTemplateChange,
    },
  ),
};

/** One kind of document's part of `window.llp`. */
export function documentApi<TEntry, TDocument, TChange>(
  port: IpcPort,
  endpoints: DocumentEndpoints<TEntry, TDocument, TChange>,
): DocumentApi<TEntry, TDocument, TChange> {
  return {
    list: port.query(endpoints.list),
    get: port.request(endpoints.get),
    subscribeList: port.subscribe(endpoints.listChanged),
    subscribe: port.subscribe(endpoints.changed),
  };
}

/** The content editing part of `window.llp`. */
export function contentApi(port: IpcPort) {
  return {
    /**
     * Asks the main process to apply an edit and answers how it went. The
     * window's draft, such as the text being typed, is its own UI state; its
     * copy of the document changes only on this answer or on a push. An edit
     * that fails its check is refused, never sent. Rejects, after logging,
     * when the call fails or the answer is malformed.
     */
    edit: port.request(contentEndpoints.edit),
  };
}

export type ContentApi = ReturnType<typeof contentApi>;
