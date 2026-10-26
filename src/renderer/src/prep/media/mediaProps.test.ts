import {describe, expect, it} from 'vitest';
import {
  DEFAULT_FIT,
  DEFAULT_SPEED,
  DEFAULT_VOLUME,
  parseTime,
  shownProps,
  timeText,
} from './mediaProps';
import {mediaItem} from './mediaTesting';

describe('media properties', () => {
  it('shows the defaults of a video, with its sound off, and of audio', () => {
    expect(shownProps(mediaItem(1, {duration: 30}))).toEqual({
      end: 'loop',
      start: 0,
      stop: 30,
      speed: DEFAULT_SPEED,
      fit: DEFAULT_FIT,
      audio: false,
      volume: DEFAULT_VOLUME,
    });
    expect(shownProps(mediaItem(2, {kind: 'audio'})).audio).toBe(true);
  });

  it('shows what the item stores', () => {
    expect(
      shownProps(
        mediaItem(1, {
          duration: 30,
          props: {
            end: 'stop',
            in: 2,
            out: 20,
            speed: 1.5,
            fit: 'fit',
            audio: true,
            volume: 40,
          },
        }),
      ),
    ).toEqual({
      end: 'stop',
      start: 2,
      stop: 20,
      speed: 1.5,
      fit: 'fit',
      audio: true,
      volume: 40,
    });
  });

  it('writes and reads times', () => {
    expect(timeText(0)).toBe('00:00.0');
    expect(timeText(30)).toBe('00:30.0');
    expect(timeText(725.54)).toBe('12:05.5');
    expect(parseTime('1:05.5')).toBe(65.5);
    expect(parseTime(' 01:05 ')).toBe(65);
    expect(parseTime('65')).toBe(65);
    expect(parseTime(timeText(42.3))).toBe(42.3);
    for (const text of ['', 'abc', '1:', ':30', '1:2:3', '-1']) {
      expect(parseTime(text)).toBeNull();
    }
  });
});
