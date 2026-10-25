import {describe, expect, it} from 'vitest';
import {MEDIA_LIMITS} from './mediaList';
import {
  parseMediaDocument,
  parseMediaImportRequest,
  parseMediaImportResult,
} from './mediaEdit';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const empty = {
  format: 'llmedia',
  schemaVersion: 1,
  items: [],
  playlists: [],
  audioPlaylists: [],
};
function document(change: object) {
  return {
    name: 'media',
    access: 'editable',
    revision: 1,
    value: {...empty, ...change},
  };
}

describe('bounded media list replies and import batches', () => {
  it('accepts the item cap and rejects an additional item', () => {
    const items = Array.from(
      {length: MEDIA_LIMITS.items + 1},
      (_value, index) => ({
        id: uuid(index + 1),
        name: 'Invented image',
        kind: 'image',
        file: `${index}.png`,
        size: 0,
      }),
    );
    expect(parseMediaDocument(document({items: items.slice(0, -1)})).ok).toBe(
      true,
    );
    expect(parseMediaDocument(document({items})).ok).toBe(false);
  });

  it('bounds both playlist kinds and their member lists', () => {
    const playlists = Array.from(
      {length: MEDIA_LIMITS.playlists + 1},
      (_value, index) => ({
        id: uuid(index + 1),
        name: 'Invented playlist',
        items: [],
      }),
    );
    expect(
      parseMediaDocument(document({playlists: playlists.slice(0, -1)})).ok,
    ).toBe(true);
    expect(parseMediaDocument(document({playlists})).ok).toBe(false);
    const audioPlaylists = playlists.map(item => ({...item, loop: false}));
    expect(
      parseMediaDocument(
        document({audioPlaylists: audioPlaylists.slice(0, -1)}),
      ).ok,
    ).toBe(true);
    expect(parseMediaDocument(document({audioPlaylists})).ok).toBe(false);
    const items = Array.from({length: MEDIA_LIMITS.playlistItems}, () =>
      uuid(1),
    );
    for (const kind of ['playlists', 'audioPlaylists']) {
      const playlist = {
        id: uuid(1),
        name: 'Invented playlist',
        items,
        loop: false,
      };
      expect(parseMediaDocument(document({[kind]: [playlist]})).ok).toBe(true);
      expect(
        parseMediaDocument(
          document({[kind]: [{...playlist, items: [...items, uuid(1)]}]}),
        ).ok,
      ).toBe(false);
    }
  });

  it('bounds incoming file paths and outgoing import job batches', () => {
    const paths = Array.from(
      {length: MEDIA_LIMITS.importBatch},
      (_value, index) => `invented-${index}.png`,
    );
    expect(
      parseMediaImportRequest({source: {kind: 'files', paths}, playlist: null})
        .ok,
    ).toBe(true);
    expect(
      parseMediaImportRequest({
        source: {kind: 'files', paths: [...paths, 'another.png']},
        playlist: null,
      }).ok,
    ).toBe(false);
    const jobs = Array.from(
      {length: MEDIA_LIMITS.importBatch},
      (_value, index) => ({
        mediaId: uuid(index + 1),
        fileName: 'Invented image.png',
        phase: 'queued',
        percent: 0,
      }),
    );
    expect(parseMediaImportResult({ok: true, value: jobs}).ok).toBe(true);
    expect(
      parseMediaImportResult({
        ok: true,
        value: [
          ...jobs,
          {...jobs[0], mediaId: uuid(MEDIA_LIMITS.importBatch + 1)},
        ],
      }).ok,
    ).toBe(false);
  });
});
