import {useEffect, useMemo, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {MediaId, SongId} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
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

/**
 * The 구성 names and background of each song the items use. A song read again
 * after a change replaces the older read, and a read that finishes after a
 * newer one for the same song is dropped.
 */
function useSongFacts(
  api: Pick<LlpApi, 'songs'>,
  songs: readonly SongId[],
): ReadonlyMap<SongId, SongFacts> {
  const [facts, setFacts] = useState<ReadonlyMap<SongId, SongFacts>>(new Map());
  useEffect(() => {
    let alive = true;
    const latest = new Map<SongId, number>();
    const wanted = new Set(songs);
    const refresh = (id: SongId): void => {
      const turn = (latest.get(id) ?? 0) + 1;
      latest.set(id, turn);
      readFacts(api, id)
        .then(read => {
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
