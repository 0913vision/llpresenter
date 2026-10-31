import {describe, expect, it} from 'vitest';
import {serializeGroupedSong} from '../schema/groupedSong';
import {createSongGroupId} from '../schema/ids';
import {sampleGroupedSong} from './testing/blockFixtures';
import {blockSnapshot} from './blockModel';
import {editGroupedBlocks as editBlocks} from './groupedBlockEdits';

describe('grouped song block edits', () => {
  it('updates text within a slide inside its group', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 1, start: 0, end: 6}),
      {type: 'text', text: 'modified', start: 0, end: 8},
    );
    expect(next.song.groups[0]?.slides[1]?.lines).toEqual(['modified']);
    expect(next.song.groups[0]?.slides[0]?.lines).toEqual(['first']);
    expect(next.song.groups[1]?.slides[0]?.lines).toEqual(['third']);
    expect(next.song.arrangements).toEqual(original.arrangements);
    expect(serializeGroupedSong(next.song, 'memory.llsong').ok).toBe(true);
  });

  it('splits slide within its group on empty line Enter and preserves arrangement references', () => {
    const original = sampleGroupedSong();
    // NOTE(0913vision): In block 0: 'first\n\nlast'
    const withBlank = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 5}),
      {type: 'text', text: 'first\n\nlast', start: 0, end: 11},
    );
    const next = editBlocks(
      blockSnapshot(withBlank.song, {block: 0, start: 6, end: 6}),
      {type: 'enter'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(3);
    expect(next.song.groups[0]?.slides[0]?.lines).toEqual(['first']);
    expect(next.song.groups[0]?.slides[1]?.lines).toEqual(['last']);
    expect(next.song.groups[0]?.slides[2]?.lines).toEqual(['second']);
    expect(next.selection).toEqual({block: 1, start: 0, end: 0});
    expect(next.song.groups[1]?.slides).toEqual(original.groups[1]?.slides);
    expect(next.song.arrangements).toEqual(original.arrangements);
  });

  it('splits slide within group via Ctrl Enter split command', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 0, start: 2, end: 4}),
      {type: 'split'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(3);
    expect(next.song.groups[0]?.slides[0]?.lines).toEqual(['fi']);
    expect(next.song.groups[0]?.slides[1]?.lines).toEqual(['t']);
    expect(next.selection).toEqual({block: 1, start: 0, end: 0});
    expect(next.song.arrangements).toEqual(original.arrangements);
  });

  it('inserts empty slide within group via Ctrl Shift N insert command', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'insert'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(3);
    expect(next.song.groups[0]?.slides[1]?.lines).toEqual([]);
    expect(next.selection).toEqual({block: 1, start: 0, end: 0});
    expect(next.song.arrangements).toEqual(original.arrangements);
  });

  it('pastes multi-line text with blank lines into multiple slides inside the group', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 0, start: 5, end: 5}),
      {type: 'paste', text: '\n\nsecondPart\n\nthirdPart'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(4);
    expect(next.song.groups[0]?.slides.map(s => s.lines)).toEqual([
      ['first'],
      ['secondPart'],
      ['thirdPart'],
      ['second'],
    ]);
  });

  it('renames group name via label command', () => {
    const original = sampleGroupedSong();
    const next = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'label', name: '새 이름'},
    );
    expect(next.song.groups[0]?.name).toBe('새 이름');
    expect(next.song.groups[0]?.id).toBe(original.groups[0]?.id);
    expect(next.song.arrangements).toEqual(original.arrangements);
  });

  it('merges within the same group when Backspace is pressed at start of non-first slide', () => {
    const original = sampleGroupedSong();
    // NOTE(0913vision): Block 1 is second slide of group 0
    const next = editBlocks(
      blockSnapshot(original, {block: 1, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(next.song.groups[0]?.slides).toHaveLength(1);
    expect(next.song.groups[0]?.slides[0]?.lines).toEqual(['first', 'second']);
    expect(next.song.groups[1]?.slides).toEqual(original.groups[1]?.slides);
    expect(next.song.arrangements).toEqual(original.arrangements);
    expect(next.selection).toEqual({block: 0, start: 5, end: 5});
    expect(next.mergeRefused).toBeUndefined();
  });

  it('preserves first hotKey or inherits on merge within group', () => {
    const singleArrangement = [
      {
        name: '기본순서',
        groups: ['11111111-1111-4111-a111-111111111111'],
      },
    ];
    const withBothKeys = sampleGroupedSong(
      [
        {
          id: '11111111-1111-4111-a111-111111111111',
          name: '1절',
          slides: [
            {lines: ['first'], hotKey: 'Digit1'},
            {lines: ['second'], hotKey: 'Digit2'},
          ],
        },
      ],
      singleArrangement,
    );
    const mergedBoth = editBlocks(
      blockSnapshot(withBothKeys, {block: 1, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(mergedBoth.song.groups[0]?.slides[0]?.hotKey).toBe('Digit1');

    const withSecondKey = sampleGroupedSong(
      [
        {
          id: '11111111-1111-4111-a111-111111111111',
          name: '1절',
          slides: [{lines: ['first']}, {lines: ['second'], hotKey: 'Digit2'}],
        },
      ],
      singleArrangement,
    );
    const mergedSecond = editBlocks(
      blockSnapshot(withSecondKey, {block: 1, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(mergedSecond.song.groups[0]?.slides[0]?.hotKey).toBe('Digit2');
  });

  it('keeps hotKey on first slide and leaves new slide without hotKey on split and enter', () => {
    const singleArrangement = [
      {
        name: '기본순서',
        groups: ['11111111-1111-4111-a111-111111111111'],
      },
    ];
    const withKey = sampleGroupedSong(
      [
        {
          id: '11111111-1111-4111-a111-111111111111',
          name: '1절',
          slides: [{lines: ['first', 'second'], hotKey: 'Digit1'}],
        },
      ],
      singleArrangement,
    );
    const split = editBlocks(
      blockSnapshot(withKey, {block: 0, start: 5, end: 5}),
      {type: 'split'},
    );
    expect(split.song.groups[0]?.slides[0]?.hotKey).toBe('Digit1');
    expect(split.song.groups[0]?.slides[1]?.hotKey).toBeUndefined();

    const withEmptyLine = sampleGroupedSong(
      [
        {
          id: '11111111-1111-4111-a111-111111111111',
          name: '1절',
          slides: [{lines: ['first', '', 'second'], hotKey: 'Digit1'}],
        },
      ],
      singleArrangement,
    );
    const entered = editBlocks(
      blockSnapshot(withEmptyLine, {block: 0, start: 6, end: 6}),
      {type: 'enter'},
    );
    expect(entered.song.groups[0]?.slides[0]?.hotKey).toBe('Digit1');
    expect(entered.song.groups[0]?.slides[1]?.hotKey).toBeUndefined();
  });

  it('refuses merge at group boundary (first slide of any group) with mergeRefused: true', () => {
    const original = sampleGroupedSong();
    // NOTE(0913vision): Block 0 is first slide of group 0 (group boundary)
    const atFirst = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(atFirst.song).toBe(original);
    expect(atFirst.mergeRefused).toBe(true);

    // NOTE(0913vision): Block 2 is first slide of group 1 (group boundary between 1절 and 후렴)
    const atSecondGroup = editBlocks(
      blockSnapshot(original, {block: 2, start: 0, end: 0}),
      {type: 'merge'},
    );
    expect(atSecondGroup.song).toBe(original);
    expect(atSecondGroup.mergeRefused).toBe(true);
    expect(atSecondGroup.song.groups).toHaveLength(2);
    expect(atSecondGroup.song.arrangements).toEqual(original.arrangements);
  });

  it('splits a group at slideIndex > 0 with caller-provided IDs and preserves unknown fields', () => {
    const original = sampleGroupedSong();
    const firstGroup = original.groups[0];
    const secondGroup = original.groups[1];
    if (firstGroup === undefined || secondGroup === undefined) {
      throw new Error('Missing sample groups');
    }
    const withUnknownFields = {
      ...original,
      groups: [{...firstGroup, futureGroupProp: 'preserve-me'}, secondGroup],
    };
    const oldG2Id = secondGroup.id;

    const newG0Id = createSongGroupId('10000000-0000-4000-8000-000000000001');
    const newG1Id = createSongGroupId('10000000-0000-4000-8000-000000000002');

    const split = editBlocks(
      blockSnapshot(withUnknownFields, {block: 1, start: 0, end: 0}),
      {type: 'label', name: '2절', ids: [newG0Id, newG1Id]},
    );

    expect(split.song.groups).toHaveLength(3);
    const g0 = split.song.groups[0];
    const g1 = split.song.groups[1];
    const g2 = split.song.groups[2];
    if (g0 === undefined || g1 === undefined || g2 === undefined) {
      throw new Error('Expected 3 groups');
    }

    expect(g0.name).toBe('1절');
    expect(g0.slides.map(s => s.lines)).toEqual([['first']]);
    expect(g0.id).toBe(newG0Id);
    expect(Reflect.get(g0, 'futureGroupProp')).toBe('preserve-me');

    expect(g1.name).toBe('2절');
    expect(g1.slides.map(s => s.lines)).toEqual([['second']]);
    expect(g1.id).toBe(newG1Id);
    expect(Reflect.get(g1, 'futureGroupProp')).toBe('preserve-me');

    expect(g2.name).toBe('후렴');
    expect(g2.id).toBe(oldG2Id);

    expect(split.song.arrangements?.[0]?.groups).toEqual([
      newG0Id,
      newG1Id,
      oldG2Id,
    ]);
    expect(split.selection).toEqual({block: 1, start: 0, end: 0});
  });
});
