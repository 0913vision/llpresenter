import {describe, expect, it} from 'vitest';
import {parseLiveCommandRequest} from '@core/schema/liveCommand';
import {
  songBackgroundFrame,
  songItemBackground,
} from '@core/songs/songBackground';

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

describe('song background placement', () => {
  const frame = {x: 200, y: 100, w: 1200, h: 700};
  const song = {background: 'song', backgroundFrame: frame};

  it('uses the song frame for its background, including in a service', () => {
    expect(songBackgroundFrame({song})).toEqual(frame);
    const command = parseLiveCommandRequest({
      type: 'media.show',
      media: {mediaId: 'song', loop: false, backgroundFrame: frame},
    });
    expect(command.ok).toBe(true);
    const batch = parseLiveCommandRequest({
      type: 'live.batch',
      commands: [
        {
          type: 'media.show',
          media: {mediaId: 'song', loop: false, backgroundFrame: frame},
        },
      ],
    });
    expect(batch.ok && batch.value.rejected).toEqual([]);
  });

  it('does not place an explicit item background using the song frame', () => {
    expect(songBackgroundFrame({song, item: 'song'})).toBeUndefined();
    expect(songBackgroundFrame({song, backgroundNone: true})).toBeUndefined();
  });

  it('leaves old songs and songs without a background unchanged', () => {
    expect(songBackgroundFrame({song: {background: 'song'}})).toBeUndefined();
    expect(
      songBackgroundFrame({song: {backgroundFrame: frame}}),
    ).toBeUndefined();
  });
});
