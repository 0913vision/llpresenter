import type {LlpApi} from '@contracts/ipc/api';
import type {
  SongDocument,
  ServiceDocument,
} from '@core/schema/contentDocuments';
import type {SongEditorTarget} from '@core/schema/ipcPayloads';
import {createSongId} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
import type {Song} from '@core/schema/song';

type ItemTarget = NonNullable<SongEditorTarget['from']>;

export async function loadItemSong(
  api: LlpApi,
  target: ItemTarget,
  songId: Song['id'],
): Promise<SongDocument | null> {
  const [service, library] = await Promise.all([
    api.services.get(target.serviceId),
    api.songs.get(songId),
  ]);
  if (service === null) return null;
  return itemSongDocument(
    service,
    target,
    library?.song ?? {
      format: 'llsong',
      schemaVersion: 1,
      id: songId,
      title: '없는 곡',
      slides: [],
    },
  );
}

/** A private editor identity keeps library pushes out of the item's draft. */
export function itemSongDocument(
  service: ServiceDocument,
  target: ItemTarget,
  source: Song,
): SongDocument | null {
  const item = service.service.order.find(row => row.id === target.itemId);
  if (
    item === undefined ||
    !isItemOfKind(item, 'song') ||
    item.song !== source.id
  ) {
    return null;
  }
  const {background: removed, ...song} = source;
  return {
    access: service.access,
    revision: service.revision,
    song: {
      ...song,
      id: createSongId(item.id),
      slides: item.slides,
      ...(item.background === undefined ? {} : {background: item.background}),
    },
  };
}

/** Routes the existing row editor's save through the service's revision check. */
export function itemSongContent(
  api: LlpApi,
  target: ItemTarget,
  songId: Song['id'],
): LlpApi['content'] {
  return {
    edit: async edit => {
      if (edit.type !== 'song.update') {
        return {
          ok: false,
          error: {reason: 'invalid', message: 'Expected an item slide edit'},
        };
      }
      const service = await api.services.get(target.serviceId);
      if (service === null) {
        return {
          ok: false,
          error: {reason: 'not-found', message: 'The service no longer exists'},
        };
      }
      if (service.revision !== edit.baseRevision) {
        return {
          ok: false,
          error: {reason: 'stale', message: 'The service changed'},
        };
      }
      const item = service.service.order.find(row => row.id === target.itemId);
      if (
        item === undefined ||
        !isItemOfKind(item, 'song') ||
        item.song !== songId
      ) {
        return {
          ok: false,
          error: {reason: 'not-found', message: 'The item changed'},
        };
      }
      const {background: removed, ...kept} = item;
      const updated = {
        ...kept,
        slides: edit.song.slides,
        ...(edit.song.background === undefined
          ? {}
          : {background: edit.song.background}),
      };
      const result = await api.content.edit({
        type: 'service.update',
        baseRevision: service.revision,
        service: {
          ...service.service,
          order: service.service.order.map(row =>
            row.id === item.id ? updated : row,
          ),
        },
      });
      return result.ok
        ? {ok: true, value: {...result.value, id: edit.song.id}}
        : result;
    },
  };
}
