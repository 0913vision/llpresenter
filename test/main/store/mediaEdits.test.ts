import {describe, expect, it} from 'vitest';
import {
  createAudioPlaylistId,
  createMediaId,
  createMediaPlaylistId,
} from '@core/schema/ids';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {MEDIA_LIMITS} from '@core/schema/mediaList';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {editMediaList, type MediaListEdit} from '@main/store/mediaEdits';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const VIDEO = createMediaId(uuid(1));
const AUDIO = createMediaId(uuid(2));
const GONE = createMediaId(uuid(9));
const LIST = createMediaPlaylistId(uuid(11));
const AUDIO_LIST = createAudioPlaylistId(uuid(12));
const GONE_LIST = createMediaPlaylistId(uuid(19));
const GONE_AUDIO_LIST = createAudioPlaylistId(uuid(18));

const list = expectSuccess(
  parseMediaDocument({
    name: 'media',
    access: 'editable',
    revision: 1,
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {id: VIDEO, name: 'Video', kind: 'video', file: 'a.mp4', size: 1},
        {id: AUDIO, name: 'Audio', kind: 'audio', file: 'b.mp3', size: 1},
      ],
      playlists: [{id: LIST, name: 'Videos', items: [VIDEO]}],
      audioPlaylists: [
        {id: AUDIO_LIST, name: 'Sounds', items: [AUDIO], loop: false},
      ],
    },
  }),
).value;

function refusal(edit: MediaListEdit) {
  const result = editMediaList(list, edit);
  if (result.ok) throw new Error('the edit was accepted');
  return result.error;
}

describe('editMediaList refusals', () => {
  it.each([
    {
      name: 'updating a playlist that is gone',
      edit: {
        type: 'media.playlist.update',
        baseRevision: 1,
        playlist: {
          kind: 'media',
          value: {id: GONE_LIST, name: 'Gone', items: []},
        },
      },
      reason: 'not-found',
    },
    {
      name: 'updating an audio playlist that is gone',
      edit: {
        type: 'media.playlist.update',
        baseRevision: 1,
        playlist: {
          kind: 'audio',
          value: {id: GONE_AUDIO_LIST, name: 'Gone', items: [], loop: false},
        },
      },
      reason: 'not-found',
    },
    {
      name: 'a playlist with an item that does not exist',
      edit: {
        type: 'media.playlist.update',
        baseRevision: 1,
        playlist: {
          kind: 'media',
          value: {id: LIST, name: 'Videos', items: [GONE]},
        },
      },
      reason: 'invalid',
    },
    {
      name: 'a video in an audio playlist',
      edit: {
        type: 'media.playlist.update',
        baseRevision: 1,
        playlist: {
          kind: 'audio',
          value: {id: AUDIO_LIST, name: 'Sounds', items: [VIDEO], loop: false},
        },
      },
      reason: 'invalid',
    },
    {
      name: 'deleting a playlist that is gone',
      edit: {
        type: 'media.playlist.delete',
        playlist: {kind: 'media', id: GONE_LIST},
      },
      reason: 'not-found',
    },
    {
      name: 'changing the properties of media that is gone',
      edit: {
        type: 'media.properties.update',
        baseRevision: 1,
        mediaId: GONE,
        changes: {name: 'Renamed'},
      },
      reason: 'not-found',
    },
    {
      name: 'deleting media that is gone',
      edit: {type: 'media.delete', mediaId: GONE},
      reason: 'not-found',
    },
  ] satisfies ReadonlyArray<{
    name: string;
    edit: MediaListEdit;
    reason: string;
  }>)('refuses $name', ({edit, reason}) => {
    expect(refusal(edit).reason).toBe(reason);
  });
});

describe('editMediaList playlists and media', () => {
  it('replaces a media playlist and an audio playlist by id', () => {
    const media = editMediaList(list, {
      type: 'media.playlist.update',
      baseRevision: 1,
      playlist: {
        kind: 'media',
        value: {id: LIST, name: 'Renamed', items: [VIDEO]},
      },
    });
    const audio = editMediaList(list, {
      type: 'media.playlist.update',
      baseRevision: 1,
      playlist: {
        kind: 'audio',
        value: {id: AUDIO_LIST, name: 'Looped', items: [AUDIO], loop: true},
      },
    });
    expect(media.ok && media.value.value.playlists[0]?.name).toBe('Renamed');
    expect(media.ok && media.value.value.audioPlaylists).toEqual(
      list.audioPlaylists,
    );
    expect(audio.ok && audio.value.value.audioPlaylists[0]).toMatchObject({
      name: 'Looped',
      loop: true,
    });
  });

  it('deletes a playlist of either kind and keeps the media files', () => {
    const media = editMediaList(list, {
      type: 'media.playlist.delete',
      playlist: {kind: 'media', id: LIST},
    });
    const audio = editMediaList(list, {
      type: 'media.playlist.delete',
      playlist: {kind: 'audio', id: AUDIO_LIST},
    });
    expect(media.ok && media.value.value.playlists).toEqual([]);
    expect(audio.ok && audio.value.value.audioPlaylists).toEqual([]);
    expect(audio.ok && audio.value.value.items).toHaveLength(2);
  });

  it('removes deleted media from every playlist', () => {
    const result = editMediaList(list, {type: 'media.delete', mediaId: VIDEO});
    expect(result.ok && result.value.value.items.map(item => item.id)).toEqual([
      AUDIO,
    ]);
    expect(result.ok && result.value.value.playlists[0]?.items).toEqual([]);
    expect(result.ok && result.value.value.audioPlaylists[0]?.items).toEqual([
      AUDIO,
    ]);
  });

  it('renames media without touching the other items', () => {
    const result = editMediaList(list, {
      type: 'media.properties.update',
      baseRevision: 1,
      mediaId: AUDIO,
      changes: {name: 'Renamed'},
    });
    expect(
      result.ok && result.value.value.items.map(item => item.name),
    ).toEqual(['Video', 'Renamed']);
  });
});

describe('editMediaList copies', () => {
  it('copies a media entry after the original on the same file, keeping its properties', () => {
    const result = editMediaList(list, {
      type: 'media.duplicate',
      mediaId: VIDEO,
    });
    if (!result.ok) throw new Error('refused');
    const items = result.value.value.items;
    expect(items.map(item => item.name)).toEqual([
      'Video',
      'Video 복사본',
      'Audio',
    ]);
    expect(items[1]).toMatchObject({file: 'a.mp4', kind: 'video', size: 1});
    expect(items[1]?.id).not.toBe(VIDEO);
    expect(result.value.id).toBe(items[1]?.id);
    expect(result.value.value.playlists).toEqual(list.playlists);
  });

  it('copies a media playlist with the same media ids, and an audio playlist with its loop', () => {
    const media = editMediaList(list, {
      type: 'media.playlist.duplicate',
      playlist: {kind: 'media', id: LIST},
    });
    if (!media.ok) throw new Error('refused');
    expect(media.value.value.playlists).toMatchObject([
      {id: LIST, name: 'Videos'},
      {id: media.value.id, name: 'Videos 복사본', items: [VIDEO]},
    ]);
    const audio = editMediaList(list, {
      type: 'media.playlist.duplicate',
      playlist: {kind: 'audio', id: AUDIO_LIST},
    });
    if (!audio.ok) throw new Error('refused');
    expect(audio.value.value.audioPlaylists).toMatchObject([
      {id: AUDIO_LIST, name: 'Sounds'},
      {id: audio.value.id, name: 'Sounds 복사본', items: [AUDIO], loop: false},
    ]);
  });

  it('refuses a copy of media or a playlist that is gone', () => {
    expect(refusal({type: 'media.duplicate', mediaId: GONE}).reason).toBe(
      'not-found',
    );
    expect(
      refusal({
        type: 'media.playlist.duplicate',
        playlist: {kind: 'media', id: GONE_LIST},
      }).reason,
    ).toBe('not-found');
    expect(
      refusal({
        type: 'media.playlist.duplicate',
        playlist: {kind: 'audio', id: GONE_AUDIO_LIST},
      }).reason,
    ).toBe('not-found');
  });
});

describe('editMediaList copy caps', () => {
  it('refuses a media copy at the media limit and leaves the list unchanged', () => {
    const full = {
      ...list,
      items: Array.from({length: MEDIA_LIMITS.items}, (_, index) => ({
        id: createMediaId(uuid(1000 + index)),
        name: `Media ${String(index)}`,
        kind: 'video' as const,
        file: 'a.mp4',
        size: 1,
      })),
    };
    const first = full.items[0];
    if (first === undefined) throw new Error('no media');
    const result = editMediaList(full, {
      type: 'media.duplicate',
      mediaId: first.id,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('invalid');
    expect(full.items).toHaveLength(MEDIA_LIMITS.items);
  });

  it.each(['media', 'audio'] as const)(
    'refuses a %s playlist copy when media and audio playlists together are at the playlist limit',
    kind => {
      const filler = Array.from(
        {length: MEDIA_LIMITS.playlists - 2},
        (_, index) => ({
          id: createMediaPlaylistId(uuid(5000 + index)),
          name: `Playlist ${String(index)}`,
          items: [],
        }),
      );
      const full = {...list, playlists: [...list.playlists, ...filler]};
      expect(full.playlists.length + full.audioPlaylists.length).toBe(
        MEDIA_LIMITS.playlists,
      );
      const result = editMediaList(full, {
        type: 'media.playlist.duplicate',
        playlist:
          kind === 'media'
            ? {kind: 'media', id: LIST}
            : {kind: 'audio', id: AUDIO_LIST},
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.reason).toBe('invalid');
      expect(full.playlists).toHaveLength(MEDIA_LIMITS.playlists - 1);
    },
  );
});
