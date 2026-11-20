import {describe, expect, it} from 'vitest';
import {songItemBackground} from '@core/songs/songBackground';

describe('song item background', () => {
  it('chooses explicit none before the item and song', () => {
    expect(
      songItemBackground({backgroundNone: true, item: 'item', song: 'song'}),
    ).toBeUndefined();
  });
  it('chooses the item over the song, even when its media is missing', () => {
    expect(songItemBackground({item: 'missing', song: 'song'})).toBe('missing');
  });
  it('uses the song when there is no item override', () => {
    expect(songItemBackground({backgroundNone: false, song: 'song'})).toBe(
      'song',
    );
    expect(songItemBackground({})).toBeUndefined();
  });
});
