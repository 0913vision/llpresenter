import {describe, expect, it} from 'vitest';
import {createSongId} from '@core/schema/common/ids';
import {
  parseShowLibrarySong,
  parseShowLibrarySongReply,
  parseShowLibrarySongRequest,
} from '@core/schema/songs/showLibrarySong';
import {parseShowService} from '@core/schema/services/showService';
import {SLIDE_LIMITS} from '@core/schema/slides/slide';
import {lyricsSlide} from '@fixtures/core/slides';

const SONG = createSongId('10000000-0000-4000-8000-000000000001');
const tile = (number = 1) => ({
  slide: lyricsSlide(number, 'Invented lyric'),
  auto: {이름표: '1절'},
  caption: '1절',
  labelColor: '#5FB8C2',
});

function service(more: object = {}) {
  return {
    revision: 3,
    id: 'service',
    name: '주일 예배',
    readOnly: false,
    rows: [
      {kind: 'header', id: 'a', title: '찬양'},
      {kind: 'song', id: 'b', title: '빛의 길', song: SONG},
      {kind: 'unknown', id: 'c', title: '', problem: 'unknown-kind'},
    ],
    tiles: {b: [tile()]},
    ...more,
  };
}

describe('the open service', () => {
  it('is none or has its rows and tiles', () => {
    expect(parseShowService(null)).toEqual({ok: true, value: null});
    expect(parseShowService(service())).toEqual({ok: true, value: service()});
  });

  it.each([
    ['a row without an id', {rows: [{kind: 'header', id: '', title: ''}]}],
    ['a row of no kind', {rows: [{kind: 'poll', id: 'a', title: ''}]}],
    [
      'a problem it does not know',
      {rows: [{kind: 'song', id: 'a', title: '', problem: 'other'}]},
    ],
    ['a tile without a slide', {tiles: {b: [{...tile(), slide: undefined}]}}],
    ['a color that is none', {tiles: {b: [{...tile(), labelColor: 'red'}]}}],
    ['a revision below zero', {revision: -1}],
  ])('refuses %s', (_name, more) => {
    expect(parseShowService(service(more)).ok).toBe(false);
  });

  it('refuses more tiles than an item may have', () => {
    const tiles = (count: number) => ({
      tiles: {b: Array.from({length: count}, (_, index) => tile(index))},
    });
    expect(parseShowService(service(tiles(SLIDE_LIMITS.slides))).ok).toBe(true);
    expect(parseShowService(service(tiles(SLIDE_LIMITS.slides + 1))).ok).toBe(
      false,
    );
  });
});

describe('a song of the library', () => {
  const song = {
    songId: SONG,
    songRevision: 2,
    title: '빛의 길',
    readOnly: false,
    tiles: [tile()],
  };

  it('is asked for by its id', () => {
    expect(parseShowLibrarySongRequest({songId: SONG}).ok).toBe(true);
    expect(parseShowLibrarySongRequest({songId: 'song'}).ok).toBe(false);
  });

  it('is none or has its tiles', () => {
    expect(parseShowLibrarySong(null)).toEqual({ok: true, value: null});
    expect(parseShowLibrarySong(song)).toEqual({ok: true, value: song});
    expect(parseShowLibrarySong({...song, title: 1}).ok).toBe(false);
  });

  it('refuses the reply for another song', () => {
    const other = createSongId('10000000-0000-4000-8000-000000000002');
    expect(parseShowLibrarySongReply(SONG, song).ok).toBe(true);
    expect(parseShowLibrarySongReply(other, song).ok).toBe(false);
  });
});
