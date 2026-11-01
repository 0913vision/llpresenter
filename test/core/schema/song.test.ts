import {describe, expect, it} from 'vitest';
import {
  DEFAULT_ARRANGEMENT_NAME,
  parseSong,
  serializeSong,
} from '@core/schema/song';
import {expectFailure, expectSuccess} from '@core/schema/testHelpers';

const FILE = 'Songs/6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab.llsong';
const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const MEDIA_ID = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';

function hymnOne() {
  return {
    format: 'llsong',
    schemaVersion: 1,
    id: SONG_ID,
    title: '만복의 근원 하나님',
    background: MEDIA_ID,
    slides: [
      {label: '1절', lines: ['만복의 근원 하나님', '온 백성 찬송 드리고']},
      {label: '후렴', lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령']},
      {lines: ['아멘']},
      {label: '', lines: []},
    ],
    arrangements: [
      {name: '주일용', slides: [1, 2, 1, 2, 3]},
      {name: '짧게', slides: [1, 3]},
    ],
    updatedAt: '2026-10-20T10:30:00+09:00',
  };
}

function parse(json: unknown) {
  return parseSong(JSON.stringify(json), FILE);
}

describe('parseSong', () => {
  it.each(['intro', 4])(
    'round trips a legacy section extension %j',
    section => {
      const source = {
        ...hymnOne(),
        slides: [{label: 'Invented', lines: ['Invented line'], section}],
        arrangements: [],
      };
      const song = expectSuccess(parse(source)).data;
      expect(song).toEqual(source);
      expect(JSON.parse(expectSuccess(serializeSong(song, FILE)))).toEqual(
        source,
      );
    },
  );

  it('reads hymn 1 with every field', () => {
    const loaded = expectSuccess(parse(hymnOne()));

    expect(loaded.data).toEqual(hymnOne());
    expect(loaded.access).toBe('editable');
    expect(loaded.sourceVersion).toBe(1);
  });

  it('reads a song with only the required fields', () => {
    const {format, schemaVersion, id, title} = hymnOne();
    const song = {format, schemaVersion, id, title, slides: [{lines: []}]};

    expect(expectSuccess(parse(song)).data).toEqual(song);
  });

  it('accepts an empty arrangement and repeated slide numbers', () => {
    const song = {
      ...hymnOne(),
      arrangements: [
        {name: '비어 있음', slides: []},
        {name: '반복', slides: [2, 2, 2]},
      ],
    };

    expect(expectSuccess(parse(song)).data).toEqual(song);
  });

  it('keeps unknown fields in the song, its slides, and its arrangements', () => {
    const song = hymnOne();
    const withUnknown = {
      ...song,
      score: {key: 'G'},
      slides: song.slides.map(slide => ({...slide, chords: ['G', 'D']})),
      arrangements: song.arrangements.map(arrangement => ({
        ...arrangement,
        color: 'teal',
      })),
    };

    const loaded = expectSuccess(parse(withUnknown));
    const written = expectSuccess(serializeSong(loaded.data, FILE));

    expect(JSON.parse(written)).toEqual(withUnknown);
  });

  it('keeps unknown keys named __proto__, prototype, and constructor', () => {
    const text = JSON.stringify(hymnOne())
      .replace('{"format"', '{"__proto__":{"a":1},"format"')
      .replace('"lines":["아멘"]', '"lines":["아멘"],"constructor":2')
      .replace('"slides":[1,3]', '"slides":[1,3],"prototype":3');

    const song = expectSuccess(parseSong(text, FILE)).data;
    const written = expectSuccess(serializeSong(song, FILE));
    const reread = expectSuccess(parseSong(written, FILE)).data;

    for (const key of ['"__proto__"', '"constructor"', '"prototype"']) {
      expect(written).toContain(key);
    }
    expect(JSON.stringify(reread)).toBe(JSON.stringify(song));
    expect(Object.getPrototypeOf(song)).toBe(Object.prototype);
  });

  it.each([
    ['an uppercase id', {id: SONG_ID.toUpperCase()}, 'id'],
    [
      'a UUID that is not v4',
      {id: '6f1c2a9e-4b7d-1c1a-9e2f-0123456789ab'},
      'id',
    ],
    ['an empty title', {title: ''}, 'title'],
    ['a blank title', {title: '   '}, 'title'],
    ['no slides', {slides: []}, 'slides'],
    ['a slide that is an array', {slides: [[]]}, 'slides.0'],
    [
      'a line that is not text',
      {slides: [{lines: ['아멘', 3]}]},
      'slides.0.lines.1',
    ],
    ['a null label', {slides: [{label: null, lines: []}]}, 'slides.0.label'],
    ['a background that is a path', {background: 'C:\\bg.mp4'}, 'background'],
    [
      'slide number 0',
      {arrangements: [{name: '짧게', slides: [0]}]},
      'arrangements.0.slides.0',
    ],
    [
      'a fractional slide number',
      {arrangements: [{name: '짧게', slides: [1.5]}]},
      'arrangements.0.slides.0',
    ],
    [
      'a slide number past the last slide',
      {arrangements: [{name: '짧게', slides: [1, 5]}]},
      'arrangements',
    ],
    [
      'the reserved default name',
      {arrangements: [{name: DEFAULT_ARRANGEMENT_NAME, slides: [1]}]},
      'arrangements.0.name',
    ],
    [
      'a repeated arrangement name',
      {
        arrangements: [
          {name: '짧게', slides: [1]},
          {name: '짧게', slides: [2]},
        ],
      },
      'arrangements.1',
    ],
    [
      'a time without an offset',
      {updatedAt: '2026-10-20T10:30:00'},
      'updatedAt',
    ],
  ])('rejects %s', (_name, change, field) => {
    const error = expectFailure(parse({...hymnOne(), ...change}));

    expect(error).toMatchObject({kind: 'invalid', file: FILE, field});
  });

  it('rejects a song without a title', () => {
    const {title: _title, ...song} = hymnOne();

    expect(expectFailure(parse(song)).field).toBe('title');
  });

  it('rejects a service file', () => {
    const error = expectFailure(parse({...hymnOne(), format: 'llservice'}));

    expect(error).toMatchObject({kind: 'format', field: 'format'});
  });
});
