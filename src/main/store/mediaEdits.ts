import {randomUUID} from 'node:crypto';
import type {Result} from '@shared/result';
import type {EditFailure, EditRefusalReason} from '@shared/schema/contentEdit';
import {createAudioPlaylistId, createMediaPlaylistId} from '@shared/schema/ids';
import type {MediaEdit} from '@shared/schema/mediaEdit';
import type {MediaList, MediaItem} from '@shared/schema/mediaList';

export type MediaListEdit = Exclude<
  MediaEdit,
  {readonly type: 'media.relink' | 'media.import.cancel'}
>;
export type PlaylistRef = NonNullable<
  import('@shared/schema/mediaEdit').MediaImportRequest['playlist']
>;

export interface MediaChange {
  readonly value: MediaList;
  readonly id: string;
}

const NEW_PLAYLIST_NAME = '새 재생목록';

export function mediaRefusal(reason: EditRefusalReason, message: string) {
  return {ok: false, error: {reason, message}} as const;
}

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
        return {
          ok: true,
          value: {
            id,
            value: {
              ...value,
              playlists: [
                ...value.playlists,
                {id, name: NEW_PLAYLIST_NAME, items: []},
              ],
            },
          },
        };
      }
      const id = createAudioPlaylistId(randomUUID());
      return {
        ok: true,
        value: {
          id,
          value: {
            ...value,
            audioPlaylists: [
              ...value.audioPlaylists,
              {id, name: NEW_PLAYLIST_NAME, items: [], loop: false},
            ],
          },
        },
      };
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
      return {
        ok: true,
        value: {
          id: playlist.value.id,
          value:
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
        },
      };
    }
    case 'media.playlist.delete': {
      if (!hasPlaylist(value, edit.playlist)) {
        return mediaRefusal('not-found', 'This playlist no longer exists');
      }
      const {id, kind} = edit.playlist;
      return {
        ok: true,
        value: {
          id,
          value:
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
        },
      };
    }
    case 'media.properties.update': {
      if (!value.items.some(item => item.id === edit.mediaId)) {
        return mediaRefusal('not-found', 'This media no longer exists');
      }
      return {
        ok: true,
        value: {
          id: edit.mediaId,
          value: {
            ...value,
            items: value.items.map(item =>
              item.id === edit.mediaId ? {...item, ...edit.changes} : item,
            ),
          },
        },
      };
    }
    case 'media.delete': {
      if (!value.items.some(item => item.id === edit.mediaId)) {
        return mediaRefusal('not-found', 'This media no longer exists');
      }
      return {
        ok: true,
        value: {
          id: edit.mediaId,
          value: {
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
          },
        },
      };
    }
  }
}
