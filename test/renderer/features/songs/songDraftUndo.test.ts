import {afterEach, expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/common/ids';
import type {SongDocument} from '@core/schema/services/contentDocuments';
import {SONG_SCHEMA_VERSION} from '@core/schema/songs/song';
import {
  closeSongDraft,
  openSongDraftWithItem,
  songUndoHistory,
  useSongDraft,
} from '@renderer/features/songs/songDraft';
import {undoTimeline} from '@renderer/platform/undo/undoTimeline';
import {lyricsSlide} from '@fixtures/core/slides';

const libraryLyrics = [lyricsSlide(2, '라이브러리 가사')];
const document: SongDocument = {
  song: {
    format: 'llsong',
    schemaVersion: SONG_SCHEMA_VERSION,
    id: createSongId('00000000-0000-4000-8000-000000000100'),
    title: '빛의 길',
    slides: libraryLyrics,
  },
  revision: 3,
  access: 'editable',
};
const service = {replay: vi.fn(() => Promise.resolve(true))};

afterEach(() => {
  undoTimeline.isolate(undefined);
  closeSongDraft();
  undoTimeline.forget(service);
  service.replay.mockClear();
});

function slides() {
  return useSongDraft.getState().draft?.song.slides;
}

it('runs back only the song while its editor shows, and the 예배 순서 again once it is gone', async () => {
  undoTimeline.record(service);
  const itemLyrics = [lyricsSlide(12, '항목 가사')];
  openSongDraftWithItem(document, itemLyrics);
  undoTimeline.isolate(songUndoHistory);
  expect(undoTimeline.get().undo).toBe(1);

  await undoTimeline.replay('undo', vi.fn());
  expect(slides()).toEqual(libraryLyrics);
  expect(undoTimeline.get()).toMatchObject({undo: 0, redo: 1});
  await undoTimeline.replay('undo', vi.fn());
  expect(service.replay).not.toHaveBeenCalled();
  await undoTimeline.replay('redo', vi.fn());
  expect(slides()).toEqual(itemLyrics);

  undoTimeline.isolate(undefined);
  closeSongDraft();
  expect(undoTimeline.get().undo).toBe(1);
  await undoTimeline.replay('undo', vi.fn());
  expect(service.replay).toHaveBeenCalledOnce();
});
