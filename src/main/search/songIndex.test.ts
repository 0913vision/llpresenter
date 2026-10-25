import {setImmediate} from 'node:timers/promises';
import {describe, expect, it} from 'vitest';
import {createSongId} from '@shared/schema/ids';
import {parseLibrarySearchResult} from '@shared/schema/librarySearch';
import type {Song} from '@shared/schema/song';
import {buildSongSearchIndex, SongSearchIndex} from './songIndex';

function song(
  number: number,
  title: string,
  lines: readonly string[] = [],
): Song {
  return {
    format: 'llsong',
    schemaVersion: 1,
    id: createSongId(
      `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    ),
    title,
    slides: [{lines}],
  };
}

describe('SongSearchIndex', () => {
  it('finds title and lyric initials with the required hymn example', async () => {
    const title = song(1, '만복의 근원 하나님');
    const lyrics = song(2, '새 노래', ['만복의 근원 하나님']);
    const index = await buildSongSearchIndex([lyrics, title]);
    const result = index.search({query: 'ㅁ ㅂ ㅇ'});
    expect(result.matches.map(match => match.songId)).toEqual([
      title.id,
      lyrics.id,
    ]);
    expect(result.matches[1]?.match).toEqual({
      kind: 'lyrics',
      line: '만복의 근원 하나님',
    });
    expect(parseLibrarySearchResult(result).ok).toBe(true);
  });

  it.each([
    ['ㄲ', '까치'],
    ['ㄸ', '딱'],
    ['ㅃ', '빨강'],
    ['ㅆ', '쌓음'],
    ['ㅉ', '짜임'],
  ])('keeps the double initial %s distinct', async (initial, title) => {
    const index = await buildSongSearchIndex([song(1, title)]);
    expect(index.search({query: initial}).matches).toHaveLength(1);
    const single = {ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ'};
    const plain = Object.entries(single).find(
      ([double]) => double === initial,
    )?.[1];
    if (plain === undefined) throw new Error('Missing single initial');
    expect(index.search({query: plain}).matches).toEqual([]);
  });

  it('normalizes NFC, case, and whitespace but treats mixed initials literally', async () => {
    const index = await buildSongSearchIndex([
      song(1, '새 노래'),
      song(2, 'Café Song'),
      song(3, '만복'),
      song(4, '만ㅂ'),
    ]);
    expect(
      index.search({query: '새노래'.normalize('NFD')}).matches[0]?.title,
    ).toBe('새 노래');
    expect(index.search({query: 'CAFE\u0301\tSONG'}).matches[0]?.title).toBe(
      'Café Song',
    );
    expect(
      index.search({query: '만ㅂ'}).matches.map(match => match.title),
    ).toEqual(['만ㅂ']);
    expect(index.search({query: ' \t\n'}).matches).toEqual([]);
  });

  it('puts title matches before lyrics, in Korean numeric title order', async () => {
    const index = await buildSongSearchIndex([
      song(1, '가나다', ['첫 찬송 줄', '다음 찬송 줄']),
      song(2, '찬송 10'),
      song(3, '찬송 2'),
      song(4, '나무', ['찬송 가사']),
    ]);
    const result = index.search({query: '찬송'});
    expect(result.matches.map(match => match.title)).toEqual([
      '찬송 2',
      '찬송 10',
      '가나다',
      '나무',
    ]);
    expect(result.matches[2]?.match).toEqual({
      kind: 'lyrics',
      line: '첫 찬송 줄',
    });
    expect(result.query).toBe('찬송');
    expect(index.search({query: ''}).matches.map(match => match.title)).toEqual(
      ['가나다', '나무', '찬송 2', '찬송 10'],
    );
  });

  it('replaces old words immediately and removes deleted songs and cached order', () => {
    const index = new SongSearchIndex();
    const first = song(1, 'Old title', ['Old lyrics']);
    index.upsert(first);
    expect(index.search({query: 'old'}).matches).toHaveLength(1);
    index.upsert({
      ...first,
      title: 'New title',
      slides: [{lines: ['Fresh words']}, {lines: []}],
    });
    expect(index.search({query: 'old'}).matches).toEqual([]);
    expect(index.search({query: 'fresh words'}).matches[0]).toMatchObject({
      title: 'New title',
      slideCount: 2,
    });
    expect(index.size).toBe(1);
    index.remove(first.id);
    expect(index.search({query: ''}).matches).toEqual([]);
    index.upsert(first);
    index.clear();
    expect(index.size).toBe(0);
    expect(index.search({query: 'old'}).matches).toEqual([]);
  });

  it('repositions a renamed song and orders equal titles by id', async () => {
    const first = song(1, 'Same title');
    const second = song(2, 'Same title');
    const index = await buildSongSearchIndex([second, first]);
    expect(
      index.search({query: ''}).matches.map(match => match.songId),
    ).toEqual([first.id, second.id]);
    index.upsert({...first, title: 'Z title'});
    expect(
      index.search({query: ''}).matches.map(match => match.songId),
    ).toEqual([second.id, first.id]);
    index.upsert({...first, title: 'A title'});
    expect(
      index.search({query: ''}).matches.map(match => match.songId),
    ).toEqual([first.id, second.id]);
  });

  it('caps default and excessive limits while honoring smaller requests', async () => {
    const index = await buildSongSearchIndex(
      Array.from({length: 150}, (_, n) => song(n, `Song ${n}`)),
    );
    expect(index.search({query: 'song'}).matches).toHaveLength(100);
    expect(index.search({query: 'song', limit: 2}).matches).toHaveLength(2);
    expect(index.search({query: 'song', limit: 10000}).matches).toHaveLength(
      100,
    );
  });

  it('yields during a 3000-song build and answers cold and warm queries within 50 ms', async () => {
    const titleShuffleFactor = 7919;
    const songs = Array.from({length: 3000}, (_, n) =>
      song(n, `시험 찬양 ${(n * titleShuffleFactor) % 3000}`, [
        `Invented verse ${n}`,
        'A shared refrain',
      ]),
    );
    let complete = false;
    const loading = buildSongSearchIndex(songs).then(index => {
      complete = true;
      return index;
    });
    await setImmediate();
    expect(complete).toBe(false);
    const index = await loading;
    expect(index.size).toBe(3000);
    for (const query of ['ㅅㅎㅊㅇ', 'shared refrain', 'no such text']) {
      const started = performance.now();
      const result = index.search({query});
      const duration = performance.now() - started;
      console.info(`Search 3000 songs (${query}): ${duration.toFixed(3)} ms`);
      expect(duration).toBeLessThan(50);
      expect(result.matches.length).toBe(query === 'no such text' ? 0 : 100);
    }
  });
});
