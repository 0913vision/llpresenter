import {sameJson} from '@core/common/sameJson';
import type {
  MediaItem,
  MediaList,
  MediaPlaylist,
  AudioPlaylist,
} from '@core/schema/mediaList';
import type {MediaEdit} from '@core/schema/mediaEdit';
import {editMediaList, mediaRefusal, type MediaChange} from './mediaEdits';
import type {Result} from '@core/common/result';
import type {EditFailure} from '@core/schema/contentEdit';

interface Occurrence {
  readonly next: string | null;
  readonly ordinal: number;
  readonly index: number;
}
interface Membership {
  readonly kind: 'media' | 'audio';
  readonly playlistId: string;
  readonly occurrences: readonly Occurrence[];
}
export type MediaDeletion =
  | {
      readonly kind: 'item';
      readonly item: MediaItem;
      readonly index: number;
      readonly next: string | null;
      readonly memberships: readonly Membership[];
    }
  | {
      readonly kind: 'mediaPlaylist';
      readonly playlist: MediaPlaylist;
      readonly index: number;
      readonly next: string | null;
    }
  | {
      readonly kind: 'audioPlaylist';
      readonly playlist: AudioPlaylist;
      readonly index: number;
      readonly next: string | null;
    };
type DeleteEdit = Extract<
  MediaEdit,
  {type: 'media.delete' | 'media.playlist.delete'}
>;

function captureOccurrences(
  items: readonly string[],
  deletedId: string,
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const counts = new Map<string, number>();
  for (const id of items) {
    if (id !== deletedId) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let next: string | null = null;
  let ordinal = 0;
  for (let position = items.length - 1; position >= 0; position--) {
    const id = items[position];
    if (id === deletedId) occurrences.push({next, ordinal, index: position});
    else if (id !== undefined) {
      ordinal = (counts.get(id) ?? 1) - 1;
      counts.set(id, ordinal);
      next = id;
    }
  }
  return occurrences.reverse();
}

export function captureMediaDeletion(
  value: MediaList,
  edit: DeleteEdit,
): MediaDeletion | undefined {
  if (edit.type === 'media.playlist.delete') {
    if (edit.playlist.kind === 'media') {
      const index = value.playlists.findIndex(
        row => row.id === edit.playlist.id,
      );
      const playlist = value.playlists[index];
      return playlist
        ? {
            kind: 'mediaPlaylist',
            playlist,
            index,
            next: value.playlists[index + 1]?.id ?? null,
          }
        : undefined;
    }
    const index = value.audioPlaylists.findIndex(
      row => row.id === edit.playlist.id,
    );
    const playlist = value.audioPlaylists[index];
    return playlist
      ? {
          kind: 'audioPlaylist',
          playlist,
          index,
          next: value.audioPlaylists[index + 1]?.id ?? null,
        }
      : undefined;
  }
  const index = value.items.findIndex(row => row.id === edit.mediaId);
  const item = value.items[index];
  if (!item) return undefined;
  const memberships: Membership[] = [];
  for (const [kind, lists] of [
    ['media', value.playlists],
    ['audio', value.audioPlaylists],
  ] as const) {
    for (const playlist of lists) {
      const occurrences = captureOccurrences(playlist.items, item.id);
      if (occurrences.length) {
        memberships.push({kind, playlistId: playlist.id, occurrences});
      }
    }
  }
  return {
    kind: 'item',
    item,
    index,
    next: value.items[index + 1]?.id ?? null,
    memberships,
  };
}

function insertBefore<T extends {readonly id: string}>(
  rows: readonly T[],
  row: T,
  {next, index: originalIndex}: {next: string | null; index: number},
): readonly T[] {
  const index = next === null ? -1 : rows.findIndex(value => value.id === next);
  const at = index < 0 ? Math.min(originalIndex, rows.length) : index;
  return [...rows.slice(0, at), row, ...rows.slice(at)];
}

export function undoMediaDeletion(
  current: MediaList,
  step: MediaDeletion,
): Result<MediaChange, EditFailure> {
  if (step.kind === 'mediaPlaylist') {
    if (current.playlists.some(row => row.id === step.playlist.id)) {
      return mediaRefusal('stale', 'Playlist already exists');
    }
    return {
      ok: true,
      value: {
        id: step.playlist.id,
        value: {
          ...current,
          playlists: insertBefore(current.playlists, step.playlist, step),
        },
      },
    };
  }
  if (step.kind === 'audioPlaylist') {
    if (current.audioPlaylists.some(row => row.id === step.playlist.id)) {
      return mediaRefusal('stale', 'Playlist already exists');
    }
    return {
      ok: true,
      value: {
        id: step.playlist.id,
        value: {
          ...current,
          audioPlaylists: insertBefore(
            current.audioPlaylists,
            step.playlist,
            step,
          ),
        },
      },
    };
  }
  if (current.items.some(row => row.id === step.item.id)) {
    return mediaRefusal('stale', 'Media already exists');
  }
  const restore = <T extends MediaPlaylist | AudioPlaylist>(
    rows: readonly T[],
    kind: Membership['kind'],
  ): readonly T[] =>
    rows.map(playlist => {
      const membership = step.memberships.find(
        row => row.kind === kind && row.playlistId === playlist.id,
      );
      if (!membership) return playlist;
      const items = [...playlist.items];
      for (const occurrence of [...membership.occurrences].reverse()) {
        let seen = 0;
        const index =
          occurrence.next === null
            ? -1
            : items.findIndex(
                id => id === occurrence.next && seen++ === occurrence.ordinal,
              );
        items.splice(
          index < 0 ? Math.min(occurrence.index, items.length) : index,
          0,
          step.item.id,
        );
      }
      return {...playlist, items};
    });
  return {
    ok: true,
    value: {
      id: step.item.id,
      value: {
        ...current,
        items: insertBefore(current.items, step.item, step),
        playlists: restore(current.playlists, 'media'),
        audioPlaylists: restore(current.audioPlaylists, 'audio'),
      },
    },
  };
}

export function redoMediaDeletion(
  current: MediaList,
  step: MediaDeletion,
): Result<MediaChange, EditFailure> {
  if (step.kind === 'item') {
    const item = current.items.find(row => row.id === step.item.id);
    if (!item || !sameJson(item, step.item)) {
      return mediaRefusal('stale', 'Restored media changed');
    }
    return editMediaList(current, {
      type: 'media.delete',
      mediaId: step.item.id,
    });
  }
  const rows =
    step.kind === 'mediaPlaylist' ? current.playlists : current.audioPlaylists;
  const playlist = rows.find(row => row.id === step.playlist.id);
  if (!playlist || !sameJson(playlist, step.playlist)) {
    return mediaRefusal('stale', 'Restored playlist changed');
  }
  return editMediaList(current, deletionEdit(step));
}

export function deletionEdit(step: MediaDeletion): DeleteEdit {
  return step.kind === 'item'
    ? {type: 'media.delete', mediaId: step.item.id}
    : {
        type: 'media.playlist.delete',
        playlist:
          step.kind === 'mediaPlaylist'
            ? {kind: 'media', id: step.playlist.id}
            : {kind: 'audio', id: step.playlist.id},
      };
}
