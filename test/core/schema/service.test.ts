import {describe, expect, it} from 'vitest';
import {
  parseService,
  parseTemplate,
  serializeService,
  serializeTemplate,
  serviceItemKind,
  isItemOfKind,
  SERVICE_LIMITS,
} from '@core/schema/service';
import {
  expectFailure,
  expectSuccess,
  TestRandom,
} from '@fixtures/core/schema/testHelpers';

const FILE = 'Services/a41e0c52-7e1f-4a2b-8c3d-4e5f60718293.llservice';
const RANDOM_SERVICES = 200;
const SERVICE_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const MEDIA_ID = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
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
      {id: itemId(3), header: 'Offering'},
      {id: itemId(4), bible: PASSAGE, memo: ''},
      {id: itemId(5), media: MEDIA_ID},
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
  it('reads a service with every current item kind', () => {
    const loaded = expectSuccess(parse(sundayService()));

    expect(loaded.data).toEqual(sundayService());
    expect(loaded.data.order.map(serviceItemKind)).toEqual([
      'header',
      'song',
      'header',
      'bible',
      'media',
    ]);
  });

  it('reads the 테마 and 오버레이 of an item and checks them', () => {
    const overlay = {
      id: itemId(20),
      name: '후렴 자막',
      from: 1,
      to: 2,
      screens: [itemId(21)],
      content: {text: '아멘'},
    };
    const item = {id: itemId(5), media: MEDIA_ID};
    const extended = {...item, theme: itemId(22), overlays: [overlay]};

    expect(expectSuccess(parse(withItem(extended))).data.order).toEqual([
      extended,
    ]);
    expect(parse(withItem({...item, theme: 'missing'})).ok).toBe(false);
    expect(
      parse(
        withItem({
          ...extended,
          overlays: [overlay, {...overlay, id: itemId(23)}],
        }),
      ).ok,
    ).toBe(false);
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
      'a song item with a song path',
      {id: itemId(1), song: 'Songs/a.llsong'},
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

  it('accepts a Bible passage that shows its reference on the last slide only', () => {
    expect(
      parse(withItem({id: itemId(1), bible: {...PASSAGE, reference: 'last'}}))
        .ok,
    ).toBe(true);
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

describe('isItemOfKind', () => {
  it('narrows an item to its kind', () => {
    const service = expectSuccess(parse(sundayService())).data;

    const songs = service.order.filter(item => isItemOfKind(item, 'song'));

    expect(songs.map(({song}) => song)).toEqual([SONG_ID]);
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
    {id, header: 'Empty section'},
    {id, media: random.uuid(), macro: random.uuid()},
    {id, future: {kind: random.integer(0, 9)}},
  ]);
}

describe('customOrder', () => {
  const GROUP_A = '11111111-1111-4111-a111-111111111111';
  const GROUP_B = '22222222-2222-4222-a222-222222222222';
  const songItem = {id: itemId(2), song: SONG_ID, arrangement: '주일용'};

  it('reads an absent, empty, and valid order and keeps unknown fields', () => {
    for (const customOrder of [undefined, [], [GROUP_A, GROUP_B, GROUP_A]]) {
      const item =
        customOrder === undefined
          ? songItem
          : {...songItem, customOrder, future: {kept: true}};
      expect(expectSuccess(parse(withItem(item))).data.order).toEqual([item]);
    }
  });

  it('refuses an entry that is not a group id and an order that is too long', () => {
    expect(parse(withItem({...songItem, customOrder: ['not-an-id']})).ok).toBe(
      false,
    );
    expect(
      parse(
        withItem({
          ...songItem,
          customOrder: new Array<string>(100_001).fill(GROUP_A),
        }),
      ).ok,
    ).toBe(false);
  });

  it('lets a template hold the order', () => {
    const item = {...songItem, customOrder: [GROUP_B]};
    const template = expectSuccess(
      parseTemplate(JSON.stringify({...sundayTemplate(), order: [item]}), FILE),
    ).data;
    expect(template.order).toEqual([item]);
  });
});

describe('service item limit', () => {
  const many = (count: number) => ({
    ...sundayService(),
    order: Array.from({length: count}, (_, index) => ({
      id: itemId(index + 1),
      header: '구역',
    })),
  });

  it('accepts a 예배 순서 and a 템플릿 at the item limit and refuses one past it', () => {
    const atLimit = many(SERVICE_LIMITS.items);
    expect(parseService(JSON.stringify(atLimit), FILE).ok).toBe(true);
    expect(
      parseService(JSON.stringify(many(SERVICE_LIMITS.items + 1)), FILE).ok,
    ).toBe(false);
    const template = {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE_ID,
      name: '템플릿',
      order: many(SERVICE_LIMITS.items + 1).order,
    };
    expect(parseTemplate(JSON.stringify(template), FILE).ok).toBe(false);
  });
});
