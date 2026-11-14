import {describe, expect, it} from 'vitest';
import {parseSong, serializeSong, SONG_LIMITS} from '@core/schema/song';
import {parseService} from '@core/schema/service';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const slide = (n = 1) => ({id: id(n), lines: ['Invented lyric']});
const song = (slides: unknown = [slide()]) => ({
  format: 'llsong',
  schemaVersion: 1,
  id: id(100),
  title: 'Invented song',
  slides,
});
const parse = (data: unknown) => parseSong(JSON.stringify(data), 'song.llsong');

describe('song slide deck contract', () => {
  it('round trips repeated titles and spacing in library and service decks', () => {
    const input = song([
      {...slide(), titleSlide: true, lines: ['Title', 'Subtitle']},
      slide(2),
      {
        ...slide(3),
        titleSlide: true,
        lines: ['Repeat', 'Subtitle'],
        titleLayout: {titleTracking: 12, subtitleTracking: 12},
      },
      slide(4),
      {...slide(5), titleSlide: true, lines: ['Closing']},
    ]);
    const read = expectSuccess(parse(input));
    expect(
      JSON.parse(expectSuccess(serializeSong(read.data, 'song.llsong'))),
    ).toEqual(input);
    expect(
      parseService(
        JSON.stringify({
          format: 'llservice',
          schemaVersion: 1,
          id: id(200),
          name: 'Service',
          date: '2026-01-01T11:00',
          order: [{id: id(201), song: id(100), slides: input.slides}],
        }),
        'service.llservice',
      ).ok,
    ).toBe(true);
    for (const lines of [
      [],
      ['Title'],
      ['Title', ''],
      ['x'.repeat(SONG_LIMITS.titleLine), 'Subtitle'],
    ]) {
      expect(parse(song([{...slide(), titleSlide: true, lines}])).ok).toBe(
        true,
      );
    }
  });
  it('retains more than two imported title paragraphs with bounded formatting', () => {
    const lines = ['First', 'Second', 'Third'];
    const lyricFormat = {
      lines: lines.map(text => ({boxWidth: 1000, runs: [{text, size: 80}]})),
    };
    const input = song([{...slide(), titleSlide: true, lines, lyricFormat}]);
    const read = expectSuccess(parse(input));
    expect(
      JSON.parse(expectSuccess(serializeSong(read.data, 'song.llsong'))),
    ).toEqual(input);
  });

  it('rejects invalid flags and oversized title text at any position', () => {
    const title = {...slide(), titleSlide: true};
    for (const slides of [
      [{...title, titleSlide: false}],
      [{...title, titleSlide: 'title'}],
      [{...title, lines: ['a', 'b', 'c']}],
      [{...title, lines: ['x'.repeat(SONG_LIMITS.titleLine + 1)]}],
      [{...title, lines: ['a\nb']}],
    ]) {
      expect(parse(song([slide(99), ...slides])).ok).toBe(false);
    }
  });
  it('round trips blank slides, free names and unknown nested fields', () => {
    const input = {
      ...song([
        {
          ...slide(),
          lines: [],
          label: '오늘',
          hotKey: 'KeyA',
          future: {kept: true},
        },
      ]),
      future: 1,
    };
    const read = expectSuccess(parse(input));
    expect(
      JSON.parse(expectSuccess(serializeSong(read.data, 'song.llsong'))),
    ).toEqual(input);
  });
  it('trims label names and rejects empty, oversized or non-string labels', () => {
    expect(
      expectSuccess(parse(song([{...slide(), label: ' 후렴 '}]))).data.slides[0]
        ?.label,
    ).toBe('후렴');
    for (const label of ['', '  ', 'x'.repeat(65), null, 1]) {
      expect(parse(song([{...slide(), label}])).ok).toBe(false);
    }
  });
  it('requires unique UUID v4 identities and assigned keys within a deck', () => {
    for (const slides of [
      [slide(), slide()],
      [{...slide(), id: 'invalid'}],
      [
        {...slide(), hotKey: 'KeyA'},
        {...slide(2), hotKey: 'KeyA'},
      ],
    ]) {
      expect(parse(song([slide(99), ...slides])).ok).toBe(false);
    }
    expect(
      parse(
        song([
          {...slide(), hotKey: 'KeyA'},
          {...slide(2), hotKey: 'KeyB'},
        ]),
      ).ok,
    ).toBe(true);
  });
  it('enforces one through ten thousand library slides without migrating groups', () => {
    expect(parse(song([])).ok).toBe(false);
    expect(
      parse(song(Array.from({length: SONG_LIMITS.slides}, (_, i) => slide(i))))
        .ok,
    ).toBe(true);
    expect(
      parse(
        song(Array.from({length: SONG_LIMITS.slides + 1}, (_, i) => slide(i))),
      ).ok,
    ).toBe(false);
    expect(
      parse({
        format: 'llsong',
        schemaVersion: 1,
        id: id(100),
        title: 'Old',
        slides: [],
      }).ok,
    ).toBe(false);
  });
  it('requires an independent service deck and allows an empty item', () => {
    const service = (item: object) =>
      parseService(
        JSON.stringify({
          format: 'llservice',
          schemaVersion: 1,
          id: id(200),
          name: 'Service',
          date: '2026-11-07T10:00',
          order: [{id: id(201), song: id(100), ...item}],
        }),
        'service.llservice',
      );
    expect(service({slides: []}).ok).toBe(true);
    expect(service({}).ok).toBe(false);
    expect(service({slides: [slide(), slide()]}).ok).toBe(false);
    expect(
      service({
        slides: [
          {...slide(), hotKey: 'KeyA'},
          {...slide(2), hotKey: 'KeyA'},
        ],
      }).ok,
    ).toBe(false);
  });
});
