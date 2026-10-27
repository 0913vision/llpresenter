import {describe, expect, it} from 'vitest';
import type {MediaId} from '@shared/schema/ids';
import type {MediaDocument} from '@shared/schema/mediaEdit';
import type {CopyJob} from './mediaCopyJobs';
import {
  ALL_MEDIA,
  chosenPlaylist,
  durationText,
  mediaEntries,
  sizeText,
  totalText,
  type MediaEntry,
} from './mediaEntries';
import type {MediaLibraryView} from './mediaLibrary';
import {
  audioPlaylistId,
  mediaDocument,
  mediaId,
  mediaItem,
  playlistId,
} from './mediaTesting';

function view(
  document: MediaDocument | null,
  jobs: readonly CopyJob[] = [],
  destinations: ReadonlyMap<MediaId, string> = new Map(),
): MediaLibraryView {
  return {document, jobs, missing: new Set(), destinations};
}

function shape(entries: readonly MediaEntry[]) {
  return entries.map(entry =>
    entry.kind === 'media'
      ? [entry.kind, entry.id, entry.copying]
      : [entry.kind, entry.id, entry.job.percent],
  );
}

const copying = {
  mediaId: mediaId(2),
  fileName: 'Invented 2.mp4',
  phase: 'analysing',
  percent: 100,
} as const;
const fresh = {
  mediaId: mediaId(9),
  fileName: 'New.mp4',
  phase: 'copying',
  percent: 40,
} as const;

const lists = mediaDocument([mediaItem(1), mediaItem(2), mediaItem(3)], 1, {
  playlists: [
    {
      id: playlistId(1),
      name: 'Backgrounds',
      items: [mediaId(3), mediaId(1), mediaId(3), mediaId(8)],
    },
  ],
  audioPlaylists: [
    {id: audioPlaylistId(1), name: '', items: [mediaId(2)], loop: true},
  ],
});

describe('media grid entries', () => {
  it('lists every item, then the files not in the list yet', () => {
    expect(
      shape(
        mediaEntries(
          view(mediaDocument([mediaItem(1), mediaItem(2)]), [copying, fresh]),
          ALL_MEDIA,
        ),
      ),
    ).toEqual([
      ['media', mediaId(1), undefined],
      ['media', mediaId(2), 100],
      ['copy', mediaId(9), 40],
    ]);
    expect(mediaEntries(view(null), ALL_MEDIA)).toEqual([]);
  });

  it("lists a playlist's items once each in its order, and only the imports into it", () => {
    const choice = {kind: 'media', id: playlistId(1)} as const;
    expect(
      shape(
        mediaEntries(
          view(lists, [fresh], new Map([[mediaId(9), playlistId(1)]])),
          choice,
        ),
      ),
    ).toEqual([
      ['media', mediaId(3), undefined],
      ['media', mediaId(1), undefined],
      ['copy', mediaId(9), 40],
    ]);
    expect(
      shape(mediaEntries(view(lists, [fresh]), choice)).map(([kind]) => kind),
    ).toEqual(['media', 'media']);
  });

  it('finds the chosen playlist with its own ids, or none when it is gone', () => {
    expect(
      chosenPlaylist(lists, {kind: 'audio', id: audioPlaylistId(1)}),
    ).toEqual({
      kind: 'audio',
      id: audioPlaylistId(1),
      name: '',
      items: [mediaId(2)],
    });
    expect(
      chosenPlaylist(lists, {kind: 'media', id: playlistId(7)}),
    ).toBeNull();
    expect(chosenPlaylist(lists, ALL_MEDIA)).toBeNull();
    expect(chosenPlaylist(null, {kind: 'media', id: playlistId(1)})).toBeNull();
  });

  it('writes durations, sizes, and the footer total', () => {
    expect(durationText(undefined)).toBeUndefined();
    expect(durationText(30.9)).toBe('0:30');
    expect(durationText(725)).toBe('12:05');
    expect(sizeText(512)).toBe('512B');
    expect(sizeText(1536)).toBe('1.5KB');
    expect(sizeText(2.1 * 1024 ** 3)).toBe('2.1GB');
    expect(
      totalText([mediaItem(1, {size: 1024}), mediaItem(2, {size: 512})]),
    ).toBe('2개 1.5KB');
  });
});
