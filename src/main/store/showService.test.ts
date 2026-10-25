import {describe, expect, it} from 'vitest';
import type {Result} from '@shared/result';
import type {MediaChoice} from '@shared/live';
import type {FileError, LoadedFile} from '@shared/schema/fileFormat';
import type {Label} from '@shared/schema/labels';
import {parseService, type Service} from '@shared/schema/service';
import {parseSong, type Song} from '@shared/schema/song';
import {DEFAULT_LABELS} from './defaults';
import {buildShowService} from './showService';
import {HYMN_ONE_ID, hymnOne, itemId, service, SUNDAY_ID} from './testFiles';

const MISSING_SONG_ID = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';
const MEDIA_ID = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
const NOTICE_ID = '5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f';

function loaded<T>(parsed: Result<LoadedFile<T>, FileError>): LoadedFile<T> {
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.value;
}

function loadedSong(json: object): LoadedFile<Song> {
  return loaded(parseSong(JSON.stringify(json), 'song.llsong'));
}

function loadedService(
  order: readonly object[],
  schemaVersion = 1,
): LoadedFile<Service> {
  const json = {
    ...service(SUNDAY_ID, '2026-11-01T11:00', order),
    schemaVersion,
  };
  return loaded(parseService(JSON.stringify(json), 'service.llservice'));
}

function build(
  order: readonly object[],
  labels: readonly Label[] = DEFAULT_LABELS,
) {
  return buildShowService({
    service: loadedService(order),
    songs: new Map([[HYMN_ONE_ID, loadedSong(hymnOne())]]),
    labels,
    revision: 3,
  });
}

describe('buildShowService', () => {
  it('resolves the item override before the song default without fallback', () => {
    const defaultMedia = {mediaId: MEDIA_ID, loop: true};
    const override = {mediaId: itemId(99), loop: false};
    const backgrounds = new Map<string, MediaChoice>([
      [MEDIA_ID, defaultMedia],
      [override.mediaId, override],
    ]);
    const project = () =>
      buildShowService({
        service: loadedService([
          {id: itemId(1), song: HYMN_ONE_ID},
          {id: itemId(2), song: HYMN_ONE_ID, background: override.mediaId},
        ]),
        songs: new Map([
          [HYMN_ONE_ID, loadedSong({...hymnOne(), background: MEDIA_ID})],
        ]),
        labels: [],
        backgrounds,
        revision: 1,
      });

    expect(project().rows).toMatchObject([
      {background: defaultMedia},
      {background: override},
    ]);
    backgrounds.delete(override.mediaId);
    const missing = project().rows[1];
    expect(missing).toMatchObject({problem: 'missing-background'});
    expect(missing).not.toHaveProperty('background');
  });

  it('marks an unavailable default without removing the lyrics', () => {
    const show = buildShowService({
      service: loadedService([{id: itemId(1), song: HYMN_ONE_ID}]),
      songs: new Map([
        [HYMN_ONE_ID, loadedSong({...hymnOne(), background: MEDIA_ID})],
      ]),
      labels: [],
      revision: 1,
    });
    expect(show.rows[0]).toMatchObject({problem: 'missing-background'});
    expect(show.rows[0]).not.toHaveProperty('background');
    expect(show.tiles[itemId(1)]).toHaveLength(3);
  });

  it('omits the background and warning when neither item nor song has one', () => {
    expect(build([{id: itemId(1), song: HYMN_ONE_ID}]).rows[0]).toEqual({
      kind: 'song',
      id: itemId(1),
      title: '만복의 근원 하나님',
    });
  });

  it('makes a row for each item with the item id', () => {
    const show = build([
      {id: itemId(1), header: '찬양'},
      {id: itemId(2), song: HYMN_ONE_ID},
      {id: itemId(3), slot: 'song', title: '찬양'},
      {
        id: itemId(4),
        bible: {
          translation: 'krv',
          ref: '요한복음 3:16-18',
          split: 'verse',
          reference: 'every',
          verseNumbers: true,
          translationName: false,
        },
      },
      {id: itemId(5), media: MEDIA_ID},
      {id: itemId(6), notice: NOTICE_ID},
      {id: itemId(7), scripture: {page: 3}},
      {id: itemId(8), song: MISSING_SONG_ID},
    ]);

    expect(show).toMatchObject({
      revision: 3,
      id: SUNDAY_ID,
      name: '주일 예배',
      readOnly: false,
    });
    expect(show.rows).toEqual([
      {kind: 'header', id: itemId(1), title: '찬양'},
      {kind: 'song', id: itemId(2), title: '만복의 근원 하나님'},
      {kind: 'slot', id: itemId(3), title: '찬양'},
      {kind: 'bible', id: itemId(4), title: '요한복음 3:16-18'},
      {kind: 'media', id: itemId(5), title: ''},
      {kind: 'notice', id: itemId(6), title: ''},
      {kind: 'unknown', id: itemId(7), title: '', problem: 'unknown-kind'},
      {kind: 'song', id: itemId(8), title: '', problem: 'missing-song'},
    ]);
    expect(Object.keys(show.tiles)).toEqual([itemId(2)]);
  });

  it('shows files from a newer app version as read-only', () => {
    const show = buildShowService({
      service: loadedService([{id: itemId(1), song: HYMN_ONE_ID}], 99),
      songs: new Map([
        [HYMN_ONE_ID, loadedSong({...hymnOne(), schemaVersion: 99})],
      ]),
      labels: DEFAULT_LABELS,
      revision: 1,
    });

    expect(show.readOnly).toBe(true);
    expect(show.rows).toEqual([
      {
        kind: 'song',
        id: itemId(1),
        title: '만복의 근원 하나님',
        problem: 'newer-version',
      },
    ]);
    expect(show.tiles[itemId(1)]).toHaveLength(3);
  });

  it('gives a song the tiles of its default order with 이름표 colors', () => {
    const show = build([{id: itemId(1), song: HYMN_ONE_ID}]);

    expect(show.tiles[itemId(1)]).toEqual([
      {
        label: '1절',
        labelColor: 'teal',
        lines: ['만복의 근원 하나님', '온 백성 찬송 드리고'],
      },
      {
        label: '후렴',
        labelColor: 'yellow',
        lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령'],
      },
      {label: null, labelColor: 'none', lines: ['아멘']},
    ]);
  });

  it('follows the chosen 구성, with a tile each time a 장 repeats', () => {
    const show = build([
      {id: itemId(1), song: HYMN_ONE_ID, arrangement: '주일용'},
    ]);

    expect(show.tiles[itemId(1)]?.map(({label}) => label)).toEqual([
      '1절',
      '후렴',
      '1절',
      '후렴',
      null,
    ]);
  });

  it.each([
    ['an empty 구성', '비어 있음'],
    ['a 구성 the song does not have', '없는 구성'],
  ])('uses the default order for %s', (_name, arrangement) => {
    const show = build([{id: itemId(1), song: HYMN_ONE_ID, arrangement}]);

    expect(show.tiles[itemId(1)]).toHaveLength(3);
  });

  it('gives a 이름표 that is not in the list no color', () => {
    const show = build(
      [{id: itemId(1), song: HYMN_ONE_ID}],
      [{name: '1절', color: 'rose', key: null}],
    );

    expect(show.tiles[itemId(1)]?.map(({labelColor}) => labelColor)).toEqual([
      'rose',
      'none',
      'none',
    ]);
  });

  it('maps each jump key to its 이름표, and the first wins a shared key', () => {
    const show = build(
      [],
      [
        {name: '1절', color: 'teal', key: 'Digit1'},
        {name: '후렴', color: 'yellow', key: 'KeyC'},
        {name: '브리지', color: 'violet', key: 'KeyC'},
        {name: '간주', color: 'gray', key: null},
      ],
    );

    expect(show.jumpKeys).toEqual({Digit1: '1절', KeyC: '후렴'});
  });
});
