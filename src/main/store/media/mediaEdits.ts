import {randomUUID} from 'node:crypto';
import type {Result} from '@core/common/result';
import type {
  EditFailure,
  EditRefusalReason,
} from '@core/schema/services/contentEdit';
import {duplicateAfter} from '@core/common/duplicateAfter';
import {
  createAudioPlaylistId,
  createMediaId,
  createMediaPlaylistId,
} from '@core/schema/common/ids';
import type {MediaEdit} from '@core/schema/media/mediaEdit';
import {
  MEDIA_LIMITS,
  type MediaList,
  type MediaItem,
} from '@core/schema/media/mediaList';

/**
 * An edit that changes only the media list: every media edit except relinking,
 * cancelling an import, and undo or redo of a delete.
 */
export type MediaListEdit = Exclude<
  MediaEdit,
  {
    readonly type:
      | 'media.relink'
      | 'media.import.cancel'
      | 'media.undoDelete'
      | 'media.redoDelete';
  }
>;
/** A reference to one playlist: its kind (media or audio) and its id. */
export type PlaylistRef = NonNullable<
  import('@core/schema/media/mediaEdit').MediaImportRequest['playlist']
>;

/**
 * The media list after an edit, and the id of what the edit made or changed.
 */
export interface MediaChange {
  readonly value: MediaList;
  readonly id: string;
}

const NEW_PLAYLIST_NAME = '새 재생목록';

/** The media list after an edit, and the id of what the edit made or changed. */
function changed(
  id: string,
  value: MediaList,
): Result<MediaChange, EditFailure> {
  return {ok: true, value: {id, value}};
}

/** A refused edit with its reason and message. */
export function mediaRefusal(reason: EditRefusalReason, message: string) {
  return {ok: false, error: {reason, message}} as const;
}

/**
 * Whether every id is an item of the list, and an item of the audio kind for an
 * audio playlist.
 */
export function playlistItemsValid(
  value: MediaList,
  playlist: PlaylistRef,
  items: readonly string[],
): boolean {
  const available = new Map<string, MediaList['items'][number]['kind']>(
    value.items.map(item => [item.id, item.kind]),
  );
  return items.every(id => {
    const kind = available.get(id);
    return (
      kind !== undefined && (playlist.kind !== 'audio' || kind === 'audio')
    );
  });
}

/** Whether the list has the playlist. */
export function hasPlaylist(value: MediaList, playlist: PlaylistRef): boolean {
  const list =
    playlist.kind === 'media' ? value.playlists : value.audioPlaylists;
  return list.some(({id}) => id === playlist.id);
}

/** Validates only incoming items, so unrelated broken legacy references remain repairable. */
export function audioReferencesFit(
  value: MediaList,
  items: readonly MediaItem[],
): boolean {
  const incoming = new Map(items.map(item => [item.id, item.kind]));
  return value.audioPlaylists.every(playlist =>
    playlist.items.every(id => {
      const kind = incoming.get(id);
      return kind === undefined || kind === 'audio';
    }),
  );
}

/** Computes a list edit; the caller validates and saves the complete result. */
export function editMediaList(
  value: MediaList,
  edit: MediaListEdit,
): Result<MediaChange, EditFailure> {
  switch (edit.type) {
    case 'media.playlist.create': {
      if (edit.kind === 'media') {
        const id = createMediaPlaylistId(randomUUID());
        return changed(id, {
          ...value,
          playlists: [
            ...value.playlists,
            {id, name: NEW_PLAYLIST_NAME, items: []},
          ],
        });
      }
      const id = createAudioPlaylistId(randomUUID());
      return changed(id, {
        ...value,
        audioPlaylists: [
          ...value.audioPlaylists,
          {id, name: NEW_PLAYLIST_NAME, items: [], loop: false},
        ],
      });
    }
    case 'media.playlist.update': {
      const {playlist} = edit;
      const ref: PlaylistRef =
        playlist.kind === 'media'
          ? {kind: 'media', id: playlist.value.id}
          : {kind: 'audio', id: playlist.value.id};
      if (!hasPlaylist(value, ref)) {
        return mediaRefusal('not-found', 'This playlist no longer exists');
      }
      if (!playlistItemsValid(value, ref, playlist.value.items)) {
        return mediaRefusal(
          'invalid',
          'Playlist items must exist and audio playlists accept only audio',
        );
      }
      return changed(
        playlist.value.id,
        playlist.kind === 'media'
          ? {
              ...value,
              playlists: value.playlists.map(item =>
                item.id === playlist.value.id ? playlist.value : item,
              ),
            }
          : {
              ...value,
              audioPlaylists: value.audioPlaylists.map(item =>
                item.id === playlist.value.id ? playlist.value : item,
              ),
            },
      );
    }
    case 'media.playlist.delete': {
      if (!hasPlaylist(value, edit.playlist)) {
        return mediaRefusal('not-found', 'This playlist no longer exists');
      }
      const {id, kind} = edit.playlist;
      return changed(
        id,
        kind === 'media'
          ? {
              ...value,
              playlists: value.playlists.filter(item => item.id !== id),
            }
          : {
              ...value,
              audioPlaylists: value.audioPlaylists.filter(
                item => item.id !== id,
              ),
            },
      );
    }
    case 'media.duplicate': {
      if (!value.items.some(item => item.id === edit.mediaId)) {
        return mediaRefusal('not-found', 'This media no longer exists');
      }
      if (value.items.length >= MEDIA_LIMITS.items) {
        return mediaRefusal('invalid', 'The media list is full');
      }
      const id = createMediaId(randomUUID());
      return changed(id, {
        ...value,
        items: duplicateAfter(
          value.items,
          {id: edit.mediaId, copyId: id},
          {limit: MEDIA_LIMITS.items, maxName: MEDIA_LIMITS.name},
        ),
      });
    }
    case 'media.playlist.duplicate': {
      const {playlist} = edit;
      if (!hasPlaylist(value, playlist)) {
        return mediaRefusal('not-found', 'This playlist no longer exists');
      }
      // NOTE(0913vision): Media and audio playlists share one limit.
      if (
        value.playlists.length + value.audioPlaylists.length >=
        MEDIA_LIMITS.playlists
      ) {
        return mediaRefusal('invalid', 'The playlist list is full');
      }
      if (playlist.kind === 'media') {
        const id = createMediaPlaylistId(randomUUID());
        return changed(id, {
          ...value,
          playlists: duplicateAfter(
            value.playlists,
            {id: playlist.id, copyId: id},
            {
              limit: MEDIA_LIMITS.playlists - value.audioPlaylists.length,
              maxName: MEDIA_LIMITS.name,
            },
          ),
        });
      }
      const id = createAudioPlaylistId(randomUUID());
      return changed(id, {
        ...value,
        audioPlaylists: duplicateAfter(
          value.audioPlaylists,
          {id: playlist.id, copyId: id},
          {
            limit: MEDIA_LIMITS.playlists - value.playlists.length,
            maxName: MEDIA_LIMITS.name,
          },
        ),
      });
    }
    case 'media.properties.update': {
      if (!value.items.some(item => item.id === edit.mediaId)) {
        return mediaRefusal('not-found', 'This media no longer exists');
      }
      return changed(edit.mediaId, {
        ...value,
        items: value.items.map(item =>
          item.id === edit.mediaId ? {...item, ...edit.changes} : item,
        ),
      });
    }
    case 'media.delete': {
      if (!value.items.some(item => item.id === edit.mediaId)) {
        return mediaRefusal('not-found', 'This media no longer exists');
      }
      return changed(edit.mediaId, {
        ...value,
        items: value.items.filter(item => item.id !== edit.mediaId),
        playlists: value.playlists.map(playlist => ({
          ...playlist,
          items: playlist.items.filter(id => id !== edit.mediaId),
        })),
        audioPlaylists: value.audioPlaylists.map(playlist => ({
          ...playlist,
          items: playlist.items.filter(id => id !== edit.mediaId),
        })),
      });
    }
  }
}
