import {parseGroupedSong, type GroupedSong} from '../../schema/groupedSong';
import {parseSong} from '../../schema/song';
import {expectSuccess} from '../../schema/testHelpers';

/** Returns an invented legacy song with repeat references; it does not persist it. */
export function song(
  lines: readonly string[] = ['first'],
  id = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
) {
  return expectSuccess(
    parseSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id,
        title: '새 아침',
        future: {kept: true},
        slides: [
          {label: '1절', lines, futureSlide: 1},
          {label: '후렴', lines: ['second'], futureSlide: 2},
          {lines: ['third']},
        ],
        arrangements: [
          {name: '주일용', slides: [3, 2, 1, 2], futureArrangement: true},
          {name: '짧게', slides: [2]},
          {name: '빈 구성', slides: []},
        ],
      }),
      'memory.llsong',
    ),
  ).data;
}

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
        schemaVersion: 2,
        id: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
        title: '새 아침',
        groups,
        arrangements,
      }),
      'memory.llsong',
    ),
  ).data;
}
