import {fixtureMedia, itemMedia} from '@core/testing/mediaList';
import {describe, expect, it} from 'vitest';
import {backgroundName, mediaName} from './backgroundChoices';

const {items} = itemMedia().value;

describe('background names', () => {
  it('distinguishes no song default from a missing picture or an audio reference', () => {
    expect(backgroundName(items, undefined)).toBe('없음');
    expect(backgroundName(items, fixtureMedia.warm)).toBe('따뜻한 빛');
    expect(backgroundName([], fixtureMedia.warm)).toBe('배경 파일 없음');
    expect(backgroundName(items, fixtureMedia.hymn)).toBe('배경 파일 없음');
  });
  it('names media without a name', () => {
    const [first] = items;
    if (first === undefined) throw new Error('No media');
    expect(mediaName({...first, name: ''})).toBe('이름 없는 미디어');
  });
});
