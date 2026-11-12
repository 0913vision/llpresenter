import {describe, expect, it} from 'vitest';
import {powerpointBackgroundName} from '@core/media/powerpointBackground';
import {MEDIA_LIMITS} from '@core/schema/mediaList';

describe('PowerPoint background names', () => {
  it('uses the song name and skips names already in the media list', () => {
    expect(powerpointBackgroundName('노래', [])).toBe('노래 배경');
    expect(powerpointBackgroundName('노래', ['노래 배경', '노래 배경 2'])).toBe(
      '노래 배경 3',
    );
    expect(powerpointBackgroundName('  노래  ', ['노래 배경'])).toBe(
      '노래 배경 2',
    );
  });
  it('keeps the name within the media limit without splitting characters', () => {
    const result = powerpointBackgroundName('😀'.repeat(200), []);
    expect(result.length).toBeLessThanOrEqual(MEDIA_LIMITS.name);
    expect(result).not.toContain('\uFFFD');
  });
});
