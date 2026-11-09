import {fixtureMedia, itemMedia} from '@fixtures/core/mediaList';
import {describe, expect, it} from 'vitest';
import {SUNDAY_NOTICE_PICTURE_ID} from '@core/themes/sundayNotice';
import {
  backgroundName,
  mediaName,
  missingBackgroundTip,
} from '@renderer/features/media/backgroundChoices';

const {items} = itemMedia().value;

describe('background names', () => {
  it('distinguishes no song default from a missing picture or an audio reference', () => {
    expect(backgroundName(items, undefined)).toBe('없음');
    expect(backgroundName(items, fixtureMedia.warm)).toBe('따뜻한 빛');
    expect(backgroundName([], fixtureMedia.warm)).toBe('배경 파일 없음');
    expect(backgroundName(items, fixtureMedia.hymn)).toBe('배경 파일 없음');
    expect(backgroundName([], SUNDAY_NOTICE_PICTURE_ID)).toBe('광고 배경');
  });
  it('names known missing files and does not invent a name for an absent catalog entry', () => {
    expect(missingBackgroundTip('Warm light')).toContain('Warm light');
    expect(missingBackgroundTip()).toContain('이름을 알 수 없는 배경');
  });
  it('names media without a name', () => {
    const [first] = items;
    if (first === undefined) throw new Error('No media');
    expect(mediaName({...first, name: ''})).toBe('이름 없는 미디어');
  });
});
