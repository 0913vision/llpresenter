import {describe, expect, it} from 'vitest';
import {
  isItemOfKind,
  parseService,
  parseTemplate,
  serializeService,
  serializeTemplate,
  SERVICE_LIMITS,
} from '@core/schema/services/service';
import {expectFailure, expectSuccess} from '@fixtures/core/schema/testHelpers';
import {lyricsSlide, slideOf, verseOf} from '@fixtures/core/slides';

const FILE = 'Services/sunday.llservice';
const SONG = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const MEDIA = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
const PASSAGE = {
  translation: 'krv',
  ref: '요한복음 3:16-18',
  verseNumbers: true,
  translationName: false,
};

const itemId = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

/** One item of each kind. */
const ITEMS: readonly object[] = [
  {kind: 'header', id: itemId(1), name: '찬양'},
  {
    kind: 'song',
    id: itemId(2),
    name: '빛의 길',
    song: SONG,
    slides: [lyricsSlide(1, '맑은 아침이 밝아 오네')],
  },
  {
    kind: 'bible',
    id: itemId(3),
    name: '요한복음 3:16-18',
    passage: PASSAGE,
    slides: [
      slideOf(2, 'scripture', {
        texts: {본문: '가'},
        verse: verseOf(1),
        continued: true,
      }),
    ],
  },
  {
    kind: 'sermon',
    id: itemId(4),
    name: '온유',
    passage: PASSAGE,
    slides: [slideOf(3, 'sermonTitle', {texts: {제목: '온유'}})],
  },
  {
    kind: 'liturgy',
    id: itemId(5),
    name: '사도신경',
    liturgy: 'creed',
    translation: 'new',
    slides: [slideOf(4, 'creed', {texts: {본문: '나는'}})],
  },
  {
    kind: 'notice',
    id: itemId(6),
    name: '광고',
    slides: [slideOf(5, 'notice', {texts: {제목: '하나'}})],
  },
  {kind: 'blank', id: itemId(7), name: '빈 슬라이드', slides: []},
  {kind: 'media', id: itemId(8), name: '영상', media: MEDIA, slides: []},
];

function service(order: readonly object[] = ITEMS) {
  return {
    format: 'llservice',
    schemaVersion: 1,
    id: 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293',
    name: '주일 예배',
    date: '2026-11-01T11:00',
    order,
  };
}

function template(order: readonly object[] = ITEMS) {
  const {date: _date, ...rest} = service(order);
  return {...rest, time: '11:00'};
}

const parse = (data: unknown) => parseService(JSON.stringify(data), FILE);

describe('a service file', () => {
  it('reads and writes an item of every kind', () => {
    const read = expectSuccess(parse(service()));
    expect(read.data.order).toEqual(ITEMS);
    expect(
      JSON.parse(expectSuccess(serializeService(read.data, FILE))),
    ).toEqual(service());
  });

  it.each([
    ['a song without its song', {...ITEMS[1], song: undefined}],
    ['a song without slides', {...ITEMS[1], slides: undefined}],
    [
      'two slides with one id',
      {
        ...ITEMS[1],
        slides: [lyricsSlide(1, 'a'), lyricsSlide(1, 'b')],
      },
    ],
    [
      'a passage without an address',
      {
        ...ITEMS[2],
        passage: {...PASSAGE, ref: ''},
      },
    ],
    ['a liturgy it does not know', {...ITEMS[4], liturgy: 'other'}],
    ['an item without a name', {...ITEMS[6], name: undefined}],
  ])('refuses %s', (_name, item) => {
    expect(parse(service([item])).ok).toBe(false);
  });

  it('keeps an item of a kind it does not know unchanged', () => {
    const later = {kind: 'poll', id: itemId(9), name: '투표', future: {a: 1}};
    const read = expectSuccess(parse(service([later])));
    expect(
      JSON.parse(expectSuccess(serializeService(read.data, FILE))),
    ).toEqual(service([later]));
  });

  it('keeps the fields it does not know', () => {
    const input = service([
      {...ITEMS[1], future: 1},
      {...ITEMS[2], passage: {...PASSAGE, future: 2}},
    ]);
    const read = expectSuccess(parse(input));
    expect(
      JSON.parse(expectSuccess(serializeService(read.data, FILE))),
    ).toEqual(input);
  });

  it('refuses two items with one id', () => {
    const [first] = ITEMS;
    expectFailure(parse(service([first ?? {}, first ?? {}])));
  });

  it.each(['2026-02-29T11:00', '2026-11-01', '2026-11-01T24:00', ''])(
    'refuses the date %s',
    date => {
      expect(parse({...service(), date}).ok).toBe(false);
    },
  );

  it('refuses one item over the cap', () => {
    const many = (count: number) =>
      service(
        Array.from({length: count}, (_, index) => ({
          kind: 'header',
          id: itemId(index + 100),
          name: '구역',
        })),
      );
    expect(parse(many(SERVICE_LIMITS.items)).ok).toBe(true);
    expect(parse(many(SERVICE_LIMITS.items + 1)).ok).toBe(false);
  });
});

describe('a template file', () => {
  it('is read and written with its time or without it', () => {
    const {time: _time, ...without} = template();
    for (const input of [template(), without]) {
      const read = expectSuccess(parseTemplate(JSON.stringify(input), FILE));
      expect(
        JSON.parse(expectSuccess(serializeTemplate(read.data, FILE))),
      ).toEqual(input);
    }
  });

  it('refuses a time that is none, and a service refuses a template', () => {
    expect(
      parseTemplate(JSON.stringify({...template(), time: '11시'}), FILE).ok,
    ).toBe(false);
    expect(parse(template()).ok).toBe(false);
  });
});

describe('isItemOfKind', () => {
  it('narrows an item to its kind', () => {
    const {order} = expectSuccess(parse(service())).data;
    const songs = order.filter(item => isItemOfKind(item, 'song'));
    expect(songs.map(item => item.song)).toEqual([SONG]);
  });
});
