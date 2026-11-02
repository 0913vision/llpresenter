import {parseGroupedSong, type GroupedSong} from '@core/schema/groupedSong';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

/** Returns an invented song with three groups; it does not persist it. */
export function song(
  lines: readonly string[] = ['first'],
  id = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
) {
  return expectSuccess(
    parseGroupedSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id,
        title: '새 아침',
        future: {kept: true},
        groups: [
          {id: SONG_GROUPS[0], name: '1절', slides: [{lines, futureSlide: 1}]},
          {
            id: SONG_GROUPS[1],
            name: '후렴',
            slides: [{lines: ['second'], futureSlide: 2}],
          },
          {id: SONG_GROUPS[2], name: '', slides: [{lines: ['third']}]},
        ],
        arrangements: [
          {
            name: '주일용',
            groups: [
              SONG_GROUPS[2],
              SONG_GROUPS[1],
              SONG_GROUPS[0],
              SONG_GROUPS[1],
            ],
            futureArrangement: true,
          },
          {name: '짧게', groups: [SONG_GROUPS[1]]},
          {name: '빈 구성', groups: []},
        ],
      }),
      'memory.llsong',
    ),
  ).data;
}

/** The group ids of `song()`, in file order. */
export const SONG_GROUPS = [
  '31111111-1111-4111-a111-111111111111',
  '32222222-2222-4222-a222-222222222222',
  '33333333-3333-4333-a333-333333333333',
] as const;

/** Returns an invented grouped song without writing files or sharing mutable state. */
export function sampleGroupedSong(
  groups: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly slides: ReadonlyArray<{
      readonly lines: readonly string[];
      readonly hotKey?: string;
    }>;
  }> = [
    {
      id: '11111111-1111-4111-a111-111111111111',
      name: '1절',
      slides: [{lines: ['first']}, {lines: ['second']}],
    },
    {
      id: '22222222-2222-4222-a222-222222222222',
      name: '후렴',
      slides: [{lines: ['third']}],
    },
  ],
  arrangements: ReadonlyArray<{
    readonly name: string;
    readonly groups: readonly string[];
  }> = [
    {
      name: '기본순서',
      groups: [
        '11111111-1111-4111-a111-111111111111',
        '22222222-2222-4222-a222-222222222222',
      ],
    },
  ],
): GroupedSong {
  return expectSuccess(
    parseGroupedSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
        title: '새 아침',
        groups,
        arrangements,
      }),
      'memory.llsong',
    ),
  ).data;
}
