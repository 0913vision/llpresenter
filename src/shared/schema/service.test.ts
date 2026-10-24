import {describe, expect, expectTypeOf, it} from 'vitest';
import type {ServiceItemId} from './ids';
import {
  parseService,
  parseTemplate,
  serializeService,
  serializeTemplate,
  serviceItemKind,
  serviceItemKinds,
  type ServiceItem,
  type ServiceItemKind,
} from './service';
import {expectFailure, expectSuccess, TestRandom} from './testHelpers';

const FILE = '예배/a41e0c52-7e1f-4a2b-8c3d-4e5f60718293.llservice';
const RANDOM_SERVICES = 200;
const SERVICE_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const MEDIA_ID = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
const NOTICE_ID = '5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f';
const MACRO_ID = '7d3f1b20-2c3d-4e4f-a051-6b7c8d9e0f1a';
const PASSAGE = {
  translation: 'krv',
  ref: '요한복음 3:16-18',
  split: 'verse',
  reference: 'every',
  verseNumbers: true,
  translationName: false,
};

function itemId(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

function sundayService() {
  return {
    format: 'llservice',
    schemaVersion: 1,
    id: SERVICE_ID,
    name: '주일 예배',
    date: '2026-11-01T11:00',
    order: [
      {id: itemId(1), header: '찬양'},
      {
        id: itemId(2),
        song: SONG_ID,
        arrangement: '주일용',
        background: MEDIA_ID,
        macro: MACRO_ID,
        memo: '천천히\n둘째 줄',
      },
      {id: itemId(3), slot: 'song', title: '찬양'},
      {id: itemId(4), bible: PASSAGE, memo: ''},
      {id: itemId(5), media: MEDIA_ID},
      {id: itemId(6), notice: NOTICE_ID, macro: '광고'},
    ],
  };
}

function sundayTemplate() {
  const {date: _date, ...service} = sundayService();
  return {...service, time: '11:00'};
}

function parse(json: unknown) {
  return parseService(JSON.stringify(json), FILE);
}

function withItem(item: object) {
  return {...sundayService(), order: [item]};
}

describe('parseService', () => {
  it('reads a service with every item kind', () => {
    const loaded = expectSuccess(parse(sundayService()));

    expect(loaded.data).toEqual(sundayService());
    expect(loaded.data.order.map(serviceItemKind)).toEqual(serviceItemKinds);
  });

  it('keeps an item of an unknown kind unchanged', () => {
    const scripture = {id: itemId(9), scripture: {page: 3}, memo: '?'};

    const service = expectSuccess(parse(withItem(scripture))).data;
    const [item] = service.order;

    expect(item).toEqual(scripture);
    expect(item === undefined ? undefined : serviceItemKind(item)).toBe(
      'unknown',
    );
    const written: unknown = JSON.parse(
      expectSuccess(serializeService(service, FILE)),
    );
    expect(written).toMatchObject({order: [scripture]});
  });

  it('keeps unknown fields in items and in the Bible passage', () => {
    const service = sundayService();
    const withUnknown = {
      ...service,
      order: [
        ...service.order.map(item => ({...item, flag: 'x'})),
        {id: itemId(7), bible: {...PASSAGE, highlight: 'yellow'}},
      ],
      theme: 'dark',
    };

    const loaded = expectSuccess(parse(withUnknown));
    const text = expectSuccess(serializeService(loaded.data, FILE));

    expect(loaded.data).toEqual(withUnknown);
    expect(expectSuccess(parseService(text, FILE)).data).toEqual(withUnknown);
    expect(text).toContain('"highlight": "yellow"');
  });

  it.each([
    [
      'an item with two kind keys',
      {id: itemId(1), song: SONG_ID, media: MEDIA_ID},
      'order.0',
    ],
    ['an item without an id', {header: '찬양'}, 'order.0.id'],
    [
      'a slot of an unknown kind',
      {id: itemId(1), slot: 'video', title: '영상'},
      'order.0.slot',
    ],
    ['a slot without a title', {id: itemId(1), slot: 'song'}, 'order.0.title'],
    [
      'a song item with a song path',
      {id: itemId(1), song: '곡/a.llsong'},
      'order.0.song',
    ],
    [
      'a memo that is not text',
      {id: itemId(1), media: MEDIA_ID, memo: 1},
      'order.0.memo',
    ],
    [
      'a Bible passage with an unknown split',
      {id: itemId(1), bible: {...PASSAGE, split: 'chapter'}},
      'order.0.bible.split',
    ],
    [
      'a Bible passage without a reference',
      {id: itemId(1), bible: {...PASSAGE, ref: ''}},
      'order.0.bible.ref',
    ],
  ])('rejects %s', (_name, item, field) => {
    const error = expectFailure(parse(withItem(item)));

    expect(error).toMatchObject({kind: 'invalid', file: FILE, field});
  });

  it('rejects an item that is not an object', () => {
    const error = expectFailure(parse({...sundayService(), order: ['찬양']}));

    expect(error).toMatchObject({kind: 'invalid', field: 'order.0'});
  });

  it('rejects two items with the same id', () => {
    const service = sundayService();
    const [first, second] = service.order;
    const order = [first, {...second, id: first?.id}];

    const error = expectFailure(parse({...service, order}));

    expect(error).toMatchObject({kind: 'invalid', field: 'order.1'});
  });

  it.each([
    ['a space instead of T', '2026-11-01 11:00'],
    ['seconds', '2026-11-01T11:00:00'],
    ['a time zone', '2026-11-01T11:00+09:00'],
    ['hour 24', '2026-11-01T24:00'],
    ['February 30', '2026-02-30T11:00'],
    ['February 29 in 2027', '2027-02-29T11:00'],
  ])('rejects a date with %s', (_name, date) => {
    expect(expectFailure(parse({...sundayService(), date})).field).toBe('date');
  });

  it('accepts February 29 in a leap year', () => {
    const service = {...sundayService(), date: '2028-02-29T09:30'};

    expect(expectSuccess(parse(service)).data.date).toBe('2028-02-29T09:30');
  });

  it('rejects a template, which has no date', () => {
    expect(expectFailure(parse(sundayTemplate())).field).toBe('date');
  });

  it('round-trips random services', () => {
    const random = new TestRandom(2);
    for (let run = 0; run < RANDOM_SERVICES; run++) {
      const raw = randomService(random);

      const service = expectSuccess(parse(raw)).data;
      const text = expectSuccess(serializeService(service, FILE));

      expect(expectSuccess(parseService(text, FILE)).data).toEqual(raw);
    }
  });
});

describe('parseTemplate', () => {
  it('reads a template with a default time and filled items', () => {
    const template = sundayTemplate();

    expect(
      expectSuccess(parseTemplate(JSON.stringify(template), FILE)).data,
    ).toEqual(template);
  });

  it('reads a template without a time', () => {
    const {time: _time, ...template} = sundayTemplate();

    expect(
      expectSuccess(parseTemplate(JSON.stringify(template), FILE)).data,
    ).toEqual(template);
  });

  it('rejects a time that is not HH:mm', () => {
    const template = {...sundayTemplate(), time: '9:30'};

    const error = expectFailure(parseTemplate(JSON.stringify(template), FILE));

    expect(error).toMatchObject({kind: 'invalid', field: 'time'});
  });

  it('writes back what it read', () => {
    const template = expectSuccess(
      parseTemplate(JSON.stringify(sundayTemplate()), FILE),
    ).data;

    const text = expectSuccess(serializeTemplate(template, FILE));

    expect(JSON.parse(text)).toEqual(sundayTemplate());
  });
});

describe('service types', () => {
  it('brands item ids and names every kind', () => {
    expectTypeOf<ServiceItem['id']>().toEqualTypeOf<ServiceItemId>();
    expectTypeOf(serviceItemKind).returns.toEqualTypeOf<
      ServiceItemKind | 'unknown'
    >();
    expectTypeOf<ServiceItemKind>().toEqualTypeOf<
      'header' | 'song' | 'slot' | 'bible' | 'media' | 'notice'
    >();
  });
});

function randomService(random: TestRandom) {
  const order = Array.from({length: random.integer(0, 8)}, () =>
    randomItem(random),
  );
  return {
    format: 'llservice',
    schemaVersion: 1,
    id: random.uuid(),
    name: random.pick(['주일 예배', '수요 예배', '']),
    date: `2026-${random.pick(['01', '06', '12'])}-1${random.integer(0, 9)}T0${random.integer(0, 9)}:30`,
    order,
  };
}

function randomItem(random: TestRandom): object {
  const id = random.uuid();
  const memo = random.boolean() ? {memo: '메모'} : {};
  return random.pick<object>([
    {id, header: '찬양'},
    {id, song: random.uuid(), ...memo},
    {id, slot: random.pick(['song', 'bible', 'slides']), title: '자리'},
    {id, media: random.uuid(), macro: random.uuid()},
    {id, notice: random.uuid(), ...memo},
    {id, future: {kind: random.integer(0, 9)}},
  ]);
}
