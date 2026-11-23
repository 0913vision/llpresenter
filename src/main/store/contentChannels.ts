import {contentEndpoints, type DocumentEndpoints} from '@contracts/ipc/content';
import type {PushEndpoint} from '@contracts/ipc/endpoint';
import type {EditResult} from '@core/schema/contentEdit';
import {IpcHost, pushToWindows} from '../base/ipcHost';
import type {Logger} from '../base/log';
import type {ContentEvents, ContentStore} from './contentStore';

/** The parts of the content store that the channels read and edit. */
type ChannelStore = Pick<
  ContentStore,
  | 'apply'
  | 'songList'
  | 'serviceList'
  | 'templateList'
  | 'song'
  | 'service'
  | 'template'
>;

/** Reading one kind of document. */
interface DocumentReads<TEntry, TDocument> {
  readonly list: () => Promise<readonly TEntry[]>;
  readonly get: (id: string) => Promise<TDocument | null>;
}

const NO_DATA: EditResult = {
  ok: false,
  error: {reason: 'not-found', message: 'The data folder could not be read'},
};

/**
 * Answers the edits of songs, 예배 순서, and 템플릿, and their reads. A request
 * that arrives before the data is read waits for it.
 *
 * @returns A function that stops answering.
 */
export function registerContentChannels(
  content: Promise<ChannelStore | null>,
  log: Logger,
): () => void {
  const ipc = new IpcHost(log);
  ipc.request(contentEndpoints.edit, async edit => {
    const store = await content;
    return store === null ? NO_DATA : store.apply(edit);
  });
  answerReads(ipc, contentEndpoints.songs, {
    list: async () => (await content)?.songList() ?? [],
    get: async id => (await content)?.song(id) ?? null,
  });
  answerReads(ipc, contentEndpoints.services, {
    list: async () => (await content)?.serviceList() ?? [],
    get: async id => (await content)?.service(id) ?? null,
  });
  answerReads(ipc, contentEndpoints.templates, {
    list: async () => (await content)?.templateList() ?? [],
    get: async id => (await content)?.template(id) ?? null,
  });
  return () => {
    ipc.close();
  };
}

/**
 * Sends every content change to every window, and refreshes the open 예배
 * 순서 after song and service document changes.
 */
export function pushContentEvents(
  log: Logger,
  refresh: () => void,
): ContentEvents {
  const push =
    <TValue>(endpoint: PushEndpoint<TValue>) =>
    (value: TValue): void => {
      pushToWindows(endpoint, value, log);
    };
  const pushAndRefresh =
    <TValue>(endpoint: PushEndpoint<TValue>) =>
    (value: TValue): void => {
      pushToWindows(endpoint, value, log);
      refresh();
    };
  const {songs, services, templates} = contentEndpoints;
  return {
    songChanged: pushAndRefresh(songs.changed),
    songsListChanged: push(songs.listChanged),
    serviceChanged: pushAndRefresh(services.changed),
    servicesListChanged: push(services.listChanged),
    templateChanged: push(templates.changed),
    templatesListChanged: push(templates.listChanged),
  };
}

function answerReads<TEntry, TDocument, TChange>(
  ipc: IpcHost,
  endpoints: DocumentEndpoints<TEntry, TDocument, TChange>,
  {list, get}: DocumentReads<TEntry, TDocument>,
): void {
  ipc.query(endpoints.list, list);
  ipc.request(endpoints.get, get);
}
