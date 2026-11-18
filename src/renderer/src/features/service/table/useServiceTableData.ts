import {useEffect, useMemo, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {MediaId, SongId} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
import {useShow} from '@renderer/session/show';
import {keepThumbnails} from '@renderer/ui/keptThumbnails';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import type {ServiceItem} from '@core/schema/service';
import type {ThemesFile} from '@core/schema/themes';
import {useFollowedDocument} from '../items/useFollowedDocument';
import {useItemMedia, useItemSettings} from '../items/useItemSources';

export type TableApi = Pick<
  LlpApi,
  'services' | 'settings' | 'media' | 'songs'
>;

/** What a cell reads from the library song of an item. */
export interface SongFacts {
  /** The song's own background, which an item without one follows. */
  readonly background: MediaId | undefined;
}

async function readFacts(
  api: Pick<LlpApi, 'songs'>,
  id: SongId,
): Promise<SongFacts> {
  const document = await api.songs.get(id);
  return {
    background: document?.song.background,
  };
}

// NOTE(0913vision): The song facts a table read stay with the window while any
// table holds them (the 준비 table data is held for the whole window) and
// follow later song changes, so a table that mounts again (준비 after 진행)
// shows each song's background in its first frame.
interface FactMemory {
  readonly facts: Map<SongId, SongFacts>;
  holders: number;
  stop: () => void;
}

const factMemory = new WeakMap<object, FactMemory>();

function knownFacts(api: Pick<LlpApi, 'songs'>): Map<SongId, SongFacts> {
  return factMemory.get(api.songs)?.facts ?? new Map<SongId, SongFacts>();
}

function holdFacts(api: Pick<LlpApi, 'songs'>): () => void {
  let memory = factMemory.get(api.songs);
  if (memory === undefined) {
    const facts = new Map<SongId, SongFacts>();
    const created: FactMemory = {facts, holders: 0, stop: () => undefined};
    created.stop = api.songs.subscribe(change => {
      if (!facts.has(change.songId)) return;
      readFacts(api, change.songId).then(
        read => facts.set(change.songId, read),
        () => facts.delete(change.songId),
      );
    });
    factMemory.set(api.songs, created);
    memory = created;
  }
  const held = memory;
  held.holders += 1;
  return () => {
    held.holders -= 1;
    if (held.holders > 0) return;
    held.stop();
    if (factMemory.get(api.songs) === held) factMemory.delete(api.songs);
  };
}

/**
 * The 구성 names and background of each song the items use. A song read again
 * after a change replaces the older read, and a read that finishes after a
 * newer one for the same song is dropped.
 */
function useSongFacts(
  api: Pick<LlpApi, 'songs'>,
  songs: readonly SongId[],
): ReadonlyMap<SongId, SongFacts> {
  const [facts, setFacts] = useState<ReadonlyMap<SongId, SongFacts>>(() => {
    const memory = knownFacts(api);
    return new Map(
      songs.flatMap(id => {
        const known = memory.get(id);
        return known === undefined ? [] : [[id, known] as const];
      }),
    );
  });
  useEffect(() => {
    let alive = true;
    const release = holdFacts(api);
    const latest = new Map<SongId, number>();
    const wanted = new Set(songs);
    const refresh = (id: SongId): void => {
      const turn = (latest.get(id) ?? 0) + 1;
      latest.set(id, turn);
      readFacts(api, id)
        .then(read => {
          factMemory.get(api.songs)?.facts.set(id, read);
          if (!alive || latest.get(id) !== turn) return;
          // NOTE(0913vision): Songs that no item uses any more leave the map
          // with the next read, so a table that stays open keeps no old facts.
          setFacts(
            current =>
              new Map(
                [...current, [id, read] as const].filter(([key]) =>
                  wanted.has(key),
                ),
              ),
          );
        })
        .catch((error: unknown) =>
          console.error('Could not read the song facts', error),
        );
    };
    for (const id of songs) refresh(id);
    const stop = api.songs.subscribe(change => {
      if (songs.includes(change.songId)) refresh(change.songId);
    });
    return () => {
      alive = false;
      stop();
      release();
    };
  }, [api, songs]);
  return useMemo(
    () => new Map([...facts].filter(([id]) => songs.includes(id))),
    [facts, songs],
  );
}

/** The items of the open 예배 순서 by id, with the lists their cells name. */
export function useServiceTableData(api: TableApi, serviceId: string | null) {
  const source = useMemo(
    () => ({
      read: async (): Promise<ServiceDocument> => {
        const document =
          serviceId === null ? null : await api.services.get(serviceId);
        if (document === null) throw new Error('The service is not readable');
        return document;
      },
      follow: (accept: (document: ServiceDocument) => void) =>
        api.services.subscribe(change => {
          if (change.serviceId === serviceId && change.document !== null) {
            accept(change.document);
          }
        }),
      kept:
        serviceId === null
          ? undefined
          : {
              owner: api.services,
              name: `service:${serviceId}`,
              is: (document: {
                readonly revision: number;
              }): document is ServiceDocument =>
                'service' in document &&
                typeof document.service === 'object' &&
                document.service !== null &&
                'id' in document.service &&
                document.service.id === serviceId,
            },
    }),
    [api, serviceId],
  );
  const service = useFollowedDocument(source, serviceId !== null);
  const themes = useItemSettings(api.settings, 'themes');
  const macros = useItemSettings(api.settings, 'macros');
  const media = useItemMedia(api.media);
  const items = useMemo(
    () =>
      new Map<string, ServiceItem>(
        (service.document?.service.order ?? []).map(item => [item.id, item]),
      ),
    [service.document],
  );
  const songIds = useMemo(
    () =>
      [...items.values()].flatMap(item =>
        isItemOfKind(item, 'song') ? [item.song] : [],
      ),
    [items],
  );
  const songs = useSongFacts(api, songIds);
  const themeFile: ThemesFile | null =
    themes.document?.name === 'themes' ? themes.document.value : null;
  const macroList =
    macros.document?.name === 'macros' ? macros.document.value.macros : [];
  return {
    items,
    themeFile,
    macroList,
    media: media.document?.value.items ?? [],
    songs,
  };
}

/**
 * Reads what the 준비 table shows from the moment the window opens, so the
 * table is complete in its first frame the first time 준비 opens too.
 */
export function TableDataKeeper({api}: {readonly api: TableApi}): null {
  const serviceId = useShow(view => view.serviceId);
  const {media} = useServiceTableData(api, serviceId);
  useEffect(() => {
    keepThumbnails(
      media
        .filter(item => item.kind !== 'audio')
        .map(item => thumbnailSrc(item.id)),
    );
  }, [media]);
  return null;
}
