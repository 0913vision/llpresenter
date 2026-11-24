import {describe, expect, it} from 'vitest';
import {isLanguageTag} from '@core/schema/common/languageTag';

describe('isLanguageTag', () => {
  it.each([
    'ko',
    'en',
    'ko-KR',
    'zh-Hant-TW',
    'sr-Latn-RS',
    'de-1996',
    'en-a-bbb-x-private',
    'x-church',
    'i-klingon',
  ])('accepts %s', tag => {
    expect(isLanguageTag(tag)).toBe(true);
  });

  it.each([
    ['an empty tag', ''],
    ['a space', 'ko KR'],
    ['an underscore', 'ko_KR'],
    ['a one-letter language', 'k'],
    ['the same variant twice', 'de-1996-1996'],
    ['the same extension twice', 'en-a-bbb-a-ccc'],
    ['Korean letters', '한국어'],
  ])('refuses %s', (_name, tag) => {
    expect(isLanguageTag(tag)).toBe(false);
  });
});
