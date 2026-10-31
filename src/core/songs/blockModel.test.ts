import {describe, expect, it} from 'vitest';
import {sampleGroupedSong} from './testing/blockFixtures';
import {linearBlockAddress, linearSlidesOf, slideCountOf} from './blockModel';

describe('grouped song block edits', () => {
  it('indexes linear blocks across groups and detects group starts', () => {
    const song = sampleGroupedSong();
    expect(slideCountOf(song)).toBe(3);

    const addr0 = linearBlockAddress(song, 0);
    expect(addr0).toMatchObject({
      groupIndex: 0,
      groupId: '11111111-1111-4111-a111-111111111111',
      groupName: '1절',
      slideIndex: 0,
      isGroupStart: true,
      slide: {lines: ['first']},
    });

    const addr1 = linearBlockAddress(song, 1);
    expect(addr1).toMatchObject({
      groupIndex: 0,
      groupId: '11111111-1111-4111-a111-111111111111',
      groupName: '1절',
      slideIndex: 1,
      isGroupStart: false,
      slide: {lines: ['second']},
    });

    const addr2 = linearBlockAddress(song, 2);
    expect(addr2).toMatchObject({
      groupIndex: 1,
      groupId: '22222222-2222-4222-a222-222222222222',
      groupName: '후렴',
      slideIndex: 0,
      isGroupStart: true,
      slide: {lines: ['third']},
    });

    expect(linearBlockAddress(song, 3)).toBeUndefined();
  });

  it('linearSlidesOf produces items with labels only on group start', () => {
    const song = sampleGroupedSong();
    const slides = linearSlidesOf(song);
    expect(slides).toEqual([
      {
        lines: ['first'],
        label: '1절',
        isGroupStart: true,
        groupId: '11111111-1111-4111-a111-111111111111',
        slideIndex: 0,
      },
      {
        lines: ['second'],
        isGroupStart: false,
        groupId: '11111111-1111-4111-a111-111111111111',
        slideIndex: 1,
      },
      {
        lines: ['third'],
        label: '후렴',
        isGroupStart: true,
        groupId: '22222222-2222-4222-a222-222222222222',
        slideIndex: 0,
      },
    ]);
  });
});
