import {expect, it} from 'vitest';
import {createSongSlideId} from '@core/schema/ids';
import {broadcastSongTitle} from '@core/songs/broadcastSongTitle';

it('formats a hymn number from the title slide without adding its English line', () => {
  const titleSlide = {
    id: createSongSlideId('00000000-0000-4000-8000-000000000001'),
    titleSlide: true as const,
    lines: ['슬픈 마음 있는 사람', '새찬송가 91장', 'English title'],
  };
  expect(
    broadcastSongTitle({title: '슬픈 마음 있는 사람', slides: [titleSlide]}),
  ).toBe('새찬송가 91장 슬픈 마음 있는 사람');
  expect(
    broadcastSongTitle({
      title: '새찬송가 91장 슬픈 마음 있는 사람',
      slides: [titleSlide],
    }),
  ).toBe('새찬송가 91장 슬픈 마음 있는 사람');
  expect(
    broadcastSongTitle({
      title: '주 사랑',
      slides: [{...titleSlide, lines: ['주 사랑', 'English title']}],
    }),
  ).toBe('주 사랑');
});
