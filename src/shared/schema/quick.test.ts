import {describe, expect, expectTypeOf, it} from 'vitest';
import type {BiblePassage} from './biblePassage';
import {
  isKnownQuickItem,
  parseQuick,
  quickItemKinds,
  serializeQuick,
  type KnownQuickItem,
} from './quick';
import {
  expectInvalidField,
  expectRoundTrip,
  expectSuccess,
} from './testHelpers';

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
    {id: itemId(6), name: '검은 화면', kind: 'black'},
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

  it('keeps an item of an unknown kind and tells it apart', () => {
    const camera = {id: itemId(7), name: '카메라', kind: 'camera', ref: 2};

    const items = expectSuccess(
      parseQuick(JSON.stringify(quickFile([camera])), 'quick.json'),
    ).data.items;

    expect(items.map(isKnownQuickItem)).toEqual([false]);
    expectRoundTrip(codec, quickFile([camera]));
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
    [
      'an unknown kind without an id',
      {name: '카메라', kind: 'camera'},
      'items.0.id',
    ],
    [
      'an unknown kind without a name',
      {id: itemId(1), kind: 'camera'},
      'items.0.name',
    ],
  ])('rejects %s', (_name, item, field) => {
    expectInvalidField(codec, quickFile([item]), field);
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

describe('quick types', () => {
  it('types the ref of a Bible item as a passage', () => {
    expectTypeOf<
      Extract<KnownQuickItem, {kind: 'bible'}>['ref']
    >().toEqualTypeOf<BiblePassage>();
  });
});
