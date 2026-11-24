import {describe, expect, it} from 'vitest';
import {
  parseQuick,
  quickItemKinds,
  serializeQuick,
} from '@core/schema/tools/quick';
import {
  expectInvalidField,
  expectRoundTrip,
  expectSuccess,
} from '@fixtures/core/schema/testHelpers';

const codec = {parse: parseQuick, serialize: serializeQuick};
const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const LOGO_PROP = 'e1e2e3e4-2222-4222-8333-444455556666';
const START_TIMER = 'b9b8b7b6-2222-4222-8333-444455556666';
const BENEDICTION = 'd1d2d3d4-3333-4222-8333-444455556666';

function itemId(number: number): string {
  return `00000000-0000-4000-9000-${String(number).padStart(12, '0')}`;
}

function everyItem() {
  return [
    {id: itemId(1), name: '만복의 근원 하나님', kind: 'song', ref: SONG_ID},
    {
      id: itemId(2),
      name: '요 3:16',
      kind: 'bible',
      ref: {
        translation: 'krv',
        ref: '요한복음 3:16',
        split: 'verse',
        reference: 'every',
        verseNumbers: true,
        translationName: false,
      },
    },
    {id: itemId(3), name: '로고 화면', kind: 'prop', ref: LOGO_PROP},
    {id: itemId(4), name: '시작 카운트다운', kind: 'timer', ref: START_TIMER},
    {id: itemId(5), name: '축도', kind: 'macro', ref: BENEDICTION},
  ];
}

function quickFile(items: readonly object[]) {
  return {format: 'llsettings.quick', schemaVersion: 1, items};
}

describe('parseQuick', () => {
  it('reads an item of every kind', () => {
    expect(everyItem().map(({kind}) => kind)).toEqual(quickItemKinds);
    expectRoundTrip(codec, quickFile(everyItem()));
  });

  it('skips old black and unknown items and omits them when saved', () => {
    const known = everyItem()[0];
    if (known === undefined) throw new Error('Missing known item');
    const old = {
      ...quickFile([
        known,
        {id: itemId(6), name: 'Black', kind: 'black', extra: true},
        {id: itemId(7), name: 'Camera', kind: 'camera', ref: 2},
      ]),
      future: {keep: true},
    };
    const loaded = expectSuccess(parseQuick(JSON.stringify(old), 'quick.json'));
    expect(loaded.data.items).toEqual([known]);
    expect(loaded.dropped).toEqual([]);
    const saved = expectSuccess(serializeQuick(loaded.data, 'quick.json'));
    expect(JSON.parse(saved)).toEqual({...old, items: [known]});
  });

  it.each([
    [
      'a song item without a ref',
      {id: itemId(1), name: '곡', kind: 'song'},
      'items.0.ref',
    ],
    [
      'a Bible item with a text ref',
      {id: itemId(1), name: '요 3:16', kind: 'bible', ref: '요 3:16'},
      'items.0.ref',
    ],
  ])('rejects %s', (_name, item, field) => {
    expectInvalidField(codec, quickFile([item]), field);
  });

  it('rejects an item that is an array', () => {
    expectInvalidField(codec, quickFile([[]]), 'items.0');
  });

  it('rejects two items with the same id', () => {
    const song = {id: itemId(1), name: '곡', kind: 'song', ref: SONG_ID};

    expectInvalidField(
      codec,
      quickFile([song, {...song, name: '사본'}]),
      'items.1',
    );
  });
});
