import {useEffect, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
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

const TIME_OF_DATE = /T(\d{2}:\d{2})$/;
const NO_TITLES: ReadonlyMap<string, string> = new Map();
const NO_TEMPLATES: readonly TemplateEntry[] = [];
const NO_SERVICES: readonly ServiceEntry[] = [];

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

/**
 * The 틀 and past service lists and the song titles their rows show. The lists
 * follow changes while the dialog is open, so a 틀 saved from it shows up;
 * `ready` turns on when all three have been read.
 */
export function useSourceLists(api: SourcesApi | undefined) {
  const [templates, setTemplates] = useState<readonly TemplateEntry[] | null>(
    null,
  );
  const [services, setServices] = useState<readonly ServiceEntry[] | null>(
    null,
  );
  const [songTitles, setSongTitles] = useState<ReadonlyMap<
    string,
    string
  > | null>(null);

  useEffect(() => {
    if (api === undefined) return undefined;
    let active = true;
    const stops = [
      api.templates.subscribeList(next => {
        if (active) setTemplates(next);
      }),
      api.services.subscribeList(next => {
        if (active) setServices(next);
      }),
    ];
    const fail = (cause: unknown): void => {
      logFailure(api, 'Could not read the service sources', cause);
      if (!active) return;
      setTemplates(current => current ?? []);
      setServices(current => current ?? []);
      setSongTitles(current => current ?? NO_TITLES);
    };
    // NOTE(0913vision): A list main pushed before the read answers is newer,
    // so the read fills only a list that is still empty.
    Promise.all([
      api.templates.list(),
      api.services.list(),
      api.songs.list(),
    ]).then(([nextTemplates, nextServices, songs]) => {
      if (!active) return;
      setTemplates(current => current ?? nextTemplates);
      setServices(current => current ?? nextServices);
      setSongTitles(new Map(songs.map(song => [song.id, song.title])));
    }, fail);
    return () => {
      active = false;
      for (const stop of stops) stop();
    };
  }, [api]);

  return {
    templates: templates ?? NO_TEMPLATES,
    services: services ?? NO_SERVICES,
    songTitles: songTitles ?? NO_TITLES,
    ready: templates !== null && services !== null && songTitles !== null,
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
  const [loaded, setLoaded] = useState<{
    readonly key: string;
    readonly document: SourceDocument | null;
  } | null>(null);

  useEffect(() => {
    if (api === undefined || source === null) return undefined;
    let active = true;
    const key = sourceKey(source);
    readSource(api, source).then(
      document => {
        if (active) setLoaded({key, document});
      },
      (cause: unknown) => {
        logFailure(api, 'Could not read a service source', cause);
        if (active) setLoaded({key, document: null});
      },
    );
    return () => {
      active = false;
    };
  }, [api, source]);

  const current =
    source !== null && loaded?.key === sourceKey(source) ? loaded : null;
  return {
    document: current?.document ?? null,
    missing: current !== null && current.document === null,
  };
}
