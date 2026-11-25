import {afterEach, expect, it} from 'vitest';
import {createSongId} from '@core/schema/common/ids';
import type {SongDocument} from '@core/schema/services/contentDocuments';
import {SONG_SCHEMA_VERSION} from '@core/schema/songs/song';
import {
  closeSongDraft,
  openSongDraftWithItem,
  replaySong,
  useSongDraft,
} from '@renderer/features/songs/draft';
import {isUnsaved} from '@renderer/features/songs/songDraftModel';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';

const titleSlide = slideOf(1, 'songTitle', {texts: {제목: '빛의 길'}});
const libraryLyrics = [lyricsSlide(2, '라이브러리 가사')];
const document: SongDocument = {
  song: {
    format: 'llsong',
    schemaVersion: SONG_SCHEMA_VERSION,
    id: createSongId('00000000-0000-4000-8000-000000000100'),
    title: '빛의 길',
    titleSlide,
    slides: libraryLyrics,
  },
  revision: 3,
  access: 'editable',
};

afterEach(() => {
  closeSongDraft();
});

it('opens the song with its own title and the item’s lyrics, unsaved, and undo shows the library song', () => {
  const itemLyrics = [lyricsSlide(12, '항목에서 고친 가사')];
  const opening = {
    ...slideOf(11, 'songTitle', {texts: {제목: '빛의 길'}}),
    label: '전주',
  };
  const closing = {
    ...slideOf(13, 'songTitle', {texts: {제목: '빛의 길'}}),
    label: '후주',
  };

  openSongDraftWithItem(document, [opening, ...itemLyrics, closing]);

  const {draft} = useSongDraft.getState();
  expect(draft?.song.slides).toEqual([titleSlide, ...itemLyrics]);
  expect(draft !== null && isUnsaved(draft)).toBe(true);
  replaySong('undo');
  expect(useSongDraft.getState().draft?.song.slides).toEqual([
    titleSlide,
    ...libraryLyrics,
  ]);
});
