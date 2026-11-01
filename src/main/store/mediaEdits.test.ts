import {describe, expect, it} from 'vitest';
import {
  createAudioPlaylistId,
  createMediaId,
  createMediaPlaylistId,
} from '@core/schema/ids';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {expectSuccess} from '@core/schema/testHelpers';
import {editMediaList, type MediaListEdit} from './mediaEdits';

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
