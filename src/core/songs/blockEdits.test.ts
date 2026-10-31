import {describe, expect, it} from 'vitest';
import {song, sampleGroupedSong} from './testing/blockFixtures';
import {blockSnapshot} from './blockModel';
import {editBlocks} from './blockEdits';

describe('song block edits', () => {
  it('expands every Ctrl Enter reference when splitting inside a line', () => {
    const original = {
      ...song(),
      arrangements: [{name: '반복', slides: [1, 3, 3]}],
    };
    const next = editBlocks(
      blockSnapshot(original, {block: 2, start: 2, end: 2}),
      {type: 'split'},
    );
    expect(next.song.slides.slice(2).map(item => item.lines)).toEqual([
      ['th'],
      ['ird'],
    ]);
    expect(next.song.arrangements?.[0]?.slides).toEqual([1, 3, 4, 3, 4]);
    expect(next.selection).toEqual({block: 3, start: 0, end: 0});
    expect(original.slides[2]?.lines).toEqual(['third']);
  });
});

describe('grouped song block edits', () => {
  it('renames a group at slide 0 preserving UUID and arrangement references without merging', () => {
    const original = sampleGroupedSong();
    const g1Id = original.groups[0]?.id;
    const g2Id = original.groups[1]?.id;

    const renamed = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'label', name: '3절'},
    );
    expect(renamed.song.groups[0]?.id).toBe(g1Id);
    expect(renamed.song.groups[0]?.name).toBe('3절');
    expect(renamed.song.groups).toHaveLength(2);
    expect(renamed.song.arrangements?.[0]?.groups).toEqual([g1Id, g2Id]);

    const sameName = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'label', name: '후렴'},
    );
    expect(sameName.song.groups).toHaveLength(2);
    expect(sameName.song.groups[0]?.name).toBe('후렴');
    expect(sameName.song.groups[0]?.id).toBe(g1Id);
    expect(sameName.song.groups[1]?.name).toBe('후렴');
    expect(sameName.song.groups[1]?.id).toBe(g2Id);

    const noLabel = editBlocks(
      blockSnapshot(original, {block: 0, start: 0, end: 0}),
      {type: 'label', name: undefined},
    );
    expect(noLabel.song.groups[0]?.name).toBe('');
    expect(noLabel.song.groups[0]?.id).toBe(g1Id);
  });
});
