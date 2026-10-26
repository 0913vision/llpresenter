import {useEffect, useState} from 'react';
import type {LlpApi, Unsubscribe} from '@shared/ipc';
import type {
  ServiceEntry,
  TemplateEntry,
} from '@shared/schema/contentDocuments';
import type {ServiceId, TemplateId} from '@shared/schema/ids';
import type {ServiceItem} from '@shared/schema/service';

/** Where a new service's items come from. */
export type ServiceSource =
  | {readonly kind: 'empty'}
  | {readonly kind: 'template'; readonly id: TemplateId}
  | {readonly kind: 'service'; readonly id: ServiceId};

export const EMPTY_SOURCE: ServiceSource = {kind: 'empty'};

/** The chosen source's document, as far as the dialogs need it. */
export interface SourceDocument {
  readonly source: ServiceSource;
  readonly name: string;
  /** HH:mm: the 틀's default time, or the past service's time. */
  readonly time: string | undefined;
  readonly order: readonly ServiceItem[];
}

export type SourcesApi = Pick<
  LlpApi,
  'services' | 'templates' | 'songs' | 'log'
>;

type ListRead<T> =
  | {readonly kind: 'loading' | 'failed'}
  | {readonly kind: 'ready'; readonly value: T};

const TIME_OF_DATE = /T(\d{2}:\d{2})$/;
const LOADING: ListRead<never> = {kind: 'loading'};
const FAILED: ListRead<never> = {kind: 'failed'};
const NO_TITLES: ReadonlyMap<string, string> = new Map();
const NO_TEMPLATES: readonly TemplateEntry[] = [];
const NO_SERVICES: readonly ServiceEntry[] = [];

const readTemplates = (api: SourcesApi): Promise<readonly TemplateEntry[]> =>
  api.templates.list();
const readServices = (api: SourcesApi): Promise<readonly ServiceEntry[]> =>
  api.services.list();
const readSongTitles = async (
  api: SourcesApi,
): Promise<ReadonlyMap<string, string>> =>
  new Map((await api.songs.list()).map(song => [song.id, song.title]));
const followTemplates = (
  api: SourcesApi,
  listener: (entries: readonly TemplateEntry[]) => void,
): Unsubscribe => api.templates.subscribeList(listener);
const followServices = (
  api: SourcesApi,
  listener: (entries: readonly ServiceEntry[]) => void,
): Unsubscribe => api.services.subscribeList(listener);

/** A source as a list value, such as `template:<id>`. */
export function sourceKey(source: ServiceSource): string {
  return source.kind === 'empty' ? 'empty' : `${source.kind}:${source.id}`;
}

/** Writes a failed read or edit of the service dialogs to the log. */
export function logFailure(
  api: Pick<LlpApi, 'log'>,
  message: string,
  cause: unknown,
): void {
  api.log.write({
    level: 'error',
    message,
    detail: cause instanceof Error ? cause.message : String(cause),
  });
}

async function readSource(
  api: SourcesApi,
  source: ServiceSource,
): Promise<SourceDocument | null> {
  if (source.kind === 'empty') {
    return {source, name: '', time: undefined, order: []};
  }
  if (source.kind === 'template') {
    const document = await api.templates.get(source.id);
    if (document === null) return null;
    const {name, time, order} = document.template;
    return {source, name, time, order};
  }
  const document = await api.services.get(source.id);
  if (document === null) return null;
  const {name, date, order} = document.service;
  return {source, name, time: TIME_OF_DATE.exec(date)?.[1], order};
}

// NOTE(0913vision): One list read on its own, so a failed read keeps the
// others. A list main pushes before the read answers is newer and stays;
// `retry` reads a failed list again, which stays failed until it answers.
function useListRead<T>({
  api,
  read,
  follow,
  what,
}: {
  readonly api: SourcesApi | undefined;
  readonly read: (api: SourcesApi) => Promise<T>;
  readonly follow?:
    | ((api: SourcesApi, listener: (value: T) => void) => Unsubscribe)
    | undefined;
  readonly what: string;
}): {readonly state: ListRead<T>; readonly retry: () => void} {
  const [state, setState] = useState<ListRead<T>>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (api === undefined || follow === undefined) return undefined;
    let active = true;
    const stop = follow(api, value => {
      if (active) setState({kind: 'ready', value});
    });
    return () => {
      active = false;
      stop();
    };
  }, [api, follow]);

  useEffect(() => {
    if (api === undefined) return undefined;
    let active = true;
    read(api).then(
      value => {
        if (!active) return;
        setState(current =>
          current.kind === 'ready' ? current : {kind: 'ready', value},
        );
      },
      (cause: unknown) => {
        logFailure(api, `Could not read ${what}`, cause);
        if (!active) return;
        setState(current => (current.kind === 'ready' ? current : FAILED));
      },
    );
    return () => {
      active = false;
    };
  }, [api, read, what, attempt]);

  const retry = (): void => {
    if (state.kind === 'failed') setAttempt(count => count + 1);
  };
  return {state, retry};
}

function valueOf<T>(read: ListRead<T>, fallback: T): T {
  return read.kind === 'ready' ? read.value : fallback;
}

/**
 * The 틀 and past service lists and the song titles their rows show. The lists
 * follow changes while the dialog is open, so a 틀 saved from it shows up.
 * Each is read on its own: `ready` turns on when every read has answered, and
 * `failed` tells that one or more failed, which `retry` reads again.
 */
export function useSourceLists(api: SourcesApi | undefined) {
  const templates = useListRead({
    api,
    read: readTemplates,
    follow: followTemplates,
    what: 'the 틀 list',
  });
  const services = useListRead({
    api,
    read: readServices,
    follow: followServices,
    what: 'the service list',
  });
  const songTitles = useListRead({
    api,
    read: readSongTitles,
    what: 'the song titles',
  });
  const reads = [templates, services, songTitles];
  return {
    templates: valueOf(templates.state, NO_TEMPLATES),
    services: valueOf(services.state, NO_SERVICES),
    songTitles: valueOf(songTitles.state, NO_TITLES),
    ready: reads.every(({state}) => state.kind !== 'loading'),
    failed: reads.some(({state}) => state.kind === 'failed'),
    retry: (): void => {
      for (const {retry} of reads) retry();
    },
  };
}

/**
 * The chosen source's document: `null` while it loads, and `missing` when
 * it was deleted or couldn't be read. A later choice replaces an earlier read.
 */
export function useSourceDocument(
  api: SourcesApi | undefined,
  source: ServiceSource | null,
) {
  const key = source === null ? null : sourceKey(source);
  // NOTE(0913vision): Each new choice gets the next read number, so a document
  // read for an earlier choice of the same source, as in A, B, then A again,
  // never shows while the new read is on its way.
  const [choice, setChoice] = useState({key, read: 0});
  if (choice.key !== key) setChoice({key, read: choice.read + 1});
  const [loaded, setLoaded] = useState<{
    readonly read: number;
    readonly document: SourceDocument | null;
  } | null>(null);

  const read = choice.read;
  useEffect(() => {
    if (api === undefined || source === null) return undefined;
    let active = true;
    readSource(api, source).then(
      document => {
        if (active) setLoaded({read, document});
      },
      (cause: unknown) => {
        logFailure(api, 'Could not read a service source', cause);
        if (active) setLoaded({read, document: null});
      },
    );
    return () => {
      active = false;
    };
  }, [api, source, read]);

  const current =
    source !== null && choice.key === key && loaded?.read === read
      ? loaded
      : null;
  return {
    document: current?.document ?? null,
    missing: current !== null && current.document === null,
  };
}
