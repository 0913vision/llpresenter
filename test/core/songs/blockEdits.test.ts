import {describe, expect, it} from 'vitest';
import {sampleSong} from '@fixtures/core/songs/blockFixtures';
import {blockSnapshot} from '@core/songs/blockModel';
import {editBlocks} from '@core/songs/blockEdits';

describe('slide text editing', () => {
  it('inserts a newline without creating a slide', () => {
    const before = blockSnapshot(sampleSong(), {block: 0, start: 2, end: 2});
    const after = editBlocks(before, {type: 'enter'});
    expect(after.song.slides).toHaveLength(3);
    expect(after.song.slides[0]?.lines).toEqual(['fi', 'rst']);
    expect(after.song.slides[0]?.id).toBe(before.song.slides[0]?.id);
  });
  it('splits a slide with a fresh identity and the same label', () => {
    const before = blockSnapshot(sampleSong(), {block: 0, start: 2, end: 2});
    const after = editBlocks(before, {type: 'split'});
    expect(after.song.slides.slice(0, 2).map(slide => slide.lines)).toEqual([
      ['fi'],
      ['rst'],
    ]);
    expect(after.song.slides[1]?.label).toBe('1절');
    expect(new Set(after.song.slides.map(slide => slide.id)).size).toBe(4);
    expect(after.selection).toEqual({block: 1, start: 0, end: 0});
  });
  it('pastes blank-line-separated slides and retains trailing text', () => {
    const before = blockSnapshot(sampleSong(), {block: 0, start: 0, end: 2});
    const after = editBlocks(before, {type: 'paste', text: 'new\r\n\r\nnext'});
    expect(after.song.slides.slice(0, 2).map(slide => slide.lines)).toEqual([
      ['new'],
      ['nextrst'],
    ]);
    expect(after.selection).toEqual({block: 1, start: 4, end: 4});
  });
  it('merges across different labels and keeps the preceding identity', () => {
    const before = blockSnapshot(sampleSong(), {block: 2, start: 0, end: 0});
    const after = editBlocks(before, {type: 'merge'});
    expect(after.song.slides[1]).toEqual({
      ...before.song.slides[1],
      lines: ['second', 'third'],
    });
    expect(after.song.slides).toHaveLength(2);
    expect(after.selection).toEqual({block: 1, start: 6, end: 6});
  });
  it('changes only one label, including a free name or no label', () => {
    const before = blockSnapshot(sampleSong());
    const named = editBlocks(before, {type: 'label', name: '  오늘  '});
    expect(named.song.slides.map(slide => slide.label)).toEqual([
      '오늘',
      '1절',
      '후렴',
    ]);
    expect(
      editBlocks(named, {type: 'label', name: undefined}).song.slides[0]?.label,
    ).toBeUndefined();
  });
});
