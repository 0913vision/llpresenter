import {describe, expect, it} from 'vitest';
import {parseGroupedSong, serializeGroupedSong} from './groupedSong';
import {expectFailure, expectSuccess} from './testHelpers';

const SONG = '00000000-0000-4000-8000-000000000001';
const FIRST = '00000000-0000-4000-8000-000000000002';
const SECOND = '00000000-0000-4000-8000-000000000003';
const FILE = 'invented.llsong';
const codes = [
  ...Array.from(
    {length: 26},
    (_, index) => `Key${String.fromCharCode(65 + index)}`,
  ),
  ...Array.from({length: 10}, (_, index) => `Digit${index}`),
];

function song() {
  return {
    format: 'llsong',
    schemaVersion: 2,
    id: SONG,
    title: 'Invented song',
    groups: [
      {
        id: FIRST,
        name: 'Same name',
        slides: [{lines: ['Invented first line'], hotKey: 'KeyA'}],
      },
      {
        id: SECOND,
        name: 'Same name',
        slides: [{lines: ['Invented second line'], hotKey: 'Digit0'}],
      },
    ],
    arrangements: [{name: 'Repeat', groups: [SECOND, FIRST, SECOND]}],
  };
}

function parse(value: unknown) {
  return parseGroupedSong(JSON.stringify(value), FILE);
}

describe('grouped slide hot keys', () => {
  it('refuses writing duplicate assignments as well as reading them', () => {
    const loaded = expectSuccess(parse(song())).data;
    const duplicate = {
      ...loaded,
      groups: loaded.groups.map(group => ({
        ...group,
        slides: group.slides.map(slide => ({...slide, hotKey: 'KeyA'})),
      })),
    };
    expect(
      expectFailure(serializeGroupedSong(duplicate, FILE)).message,
    ).toContain('already uses this hot key');
  });
  it('round trips all 36 physical codes assigned to distinct source slides', () => {
    const input = {
      ...song(),
      groups: [
        {
          id: FIRST,
          name: '',
          slides: codes.map((hotKey, index) => ({
            lines: [`Invented line ${index}`],
            hotKey,
            extra: {kept: true},
          })),
        },
      ],
      arrangements: [{name: 'Repeat', groups: [FIRST, FIRST]}],
    };
    const loaded = expectSuccess(parse(input));
    expect(loaded.data).toEqual(input);
    const text = expectSuccess(serializeGroupedSong(loaded.data, FILE));
    expect(expectSuccess(parseGroupedSong(text, FILE)).data).toEqual(input);
  });

  it('keeps absent assignments absent and permits repeated group occurrences', () => {
    const input = {
      ...song(),
      groups: [
        {
          id: FIRST,
          name: '',
          slides: [{lines: []}, {lines: ['Invented line'], hotKey: 'KeyZ'}],
        },
      ],
      arrangements: [{name: 'Repeat', groups: [FIRST, FIRST, FIRST]}],
    };
    const loaded = expectSuccess(parse(input));
    expect(loaded.data.groups[0]?.slides[0]).not.toHaveProperty('hotKey');
    expect(
      JSON.parse(expectSuccess(serializeGroupedSong(loaded.data, FILE))),
    ).toEqual(input);
  });

  it.each([
    null,
    '',
    'A',
    'a',
    'keyA',
    'KeyAA',
    'Digit10',
    'Numpad1',
    'F1',
    'ArrowLeft',
    '가',
    false,
    12,
    {code: 'KeyA'},
  ])('rejects invalid assignment %j', hotKey => {
    expectFailure(
      parse({
        ...song(),
        groups: [{id: FIRST, name: '', slides: [{lines: [], hotKey}]}],
        arrangements: [],
      }),
    );
  });

  it.each(['inside a group', 'across groups'])(
    'refuses duplicate codes %s',
    placement => {
      const input =
        placement === 'inside a group'
          ? {
              ...song(),
              groups: [
                {
                  id: FIRST,
                  name: '',
                  slides: [
                    {lines: [], hotKey: 'KeyA'},
                    {lines: [], hotKey: 'KeyA'},
                  ],
                },
              ],
              arrangements: [],
            }
          : {
              ...song(),
              groups: song().groups.map(group => ({
                ...group,
                slides: [{lines: [], hotKey: 'KeyA'}],
              })),
            };
      expect(expectFailure(parse(input)).message).toContain(
        'already uses this hot key',
      );
    },
  );

  it('archives unknown legacy hotKey values rather than inventing assignments or losing fields', () => {
    const input = {
      format: 'llsong',
      schemaVersion: 1,
      id: SONG,
      title: 'Invented old song',
      slides: [
        {
          label: 'Verse',
          lines: ['Invented first'],
          hotKey: 'KeyA',
          legacyV1: {original: true},
          extra: 'kept',
        },
        {label: 'Verse', lines: ['Invented second'], hotKey: {future: true}},
      ],
    };
    const loaded = expectSuccess(parse(input));
    const [first, second] = loaded.data.groups[0]?.slides ?? [];
    expect(first).not.toHaveProperty('hotKey');
    expect(first).toHaveProperty('legacyV1', {
      legacyV1: {original: true},
      hotKey: 'KeyA',
    });
    expect(first).toHaveProperty('extra', 'kept');
    expect(second).toHaveProperty('legacyV1', {hotKey: {future: true}});
    const text = expectSuccess(serializeGroupedSong(loaded.data, FILE));
    expect(expectSuccess(parseGroupedSong(text, FILE)).data).toEqual(
      loaded.data,
    );
  });
});
