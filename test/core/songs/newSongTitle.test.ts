import {describe, expect, it} from 'vitest';
import {createSongId, createSongSlideId} from '@core/schema/ids';
import type {Song} from '@core/schema/song';
import {titleSlidesForCopy} from '@core/songs/newSongTitle';

const song: Song = {
  format: 'llsong',
  schemaVersion: 1,
  id: createSongId('00000000-0000-4000-8000-000000000001'),
  title: 'Original',
  slides: [
    {
      id: createSongSlideId('00000000-0000-4000-8000-000000000002'),
      lines: ['Verse'],
    },
  ],
};
const newId = () => '00000000-0000-4000-8000-000000000003';
describe('opening slide for copies', () => {
  it('adds the copied name before the body when the source has no title', () => {
    expect(titleSlidesForCopy(song, 'Copy', newId)).toEqual([
      {id: newId(), titleSlide: true, lines: ['Copy']},
      ...song.slides,
    ]);
    expect(song.slides).toHaveLength(1);
  });
  it('renames a matching title while keeping its subtitle and custom titles', () => {
    const base = song.slides[0];
    if (base === undefined) throw new Error('Missing slide');
    const first = {
      ...base,
      titleSlide: true as const,
      lines: ['Original', 'Subtitle'],
    };
    expect(
      titleSlidesForCopy({...song, slides: [first]}, 'Copy', newId)[0]?.lines,
    ).toEqual(['Copy', 'Subtitle']);
    const custom = {...first, lines: ['Custom']};
    expect(
      titleSlidesForCopy({...song, slides: [custom]}, 'Copy', newId)[0],
    ).toEqual(custom);
  });
});
