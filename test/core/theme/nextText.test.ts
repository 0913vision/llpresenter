import {describe, expect, it} from 'vitest';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';
import {nextTextOf, type SlideContent} from '@core/theme/content';

function next(
  name: string,
  content: Partial<SlideContent>,
  first = false,
): string | null {
  const theme = BUILT_IN_THEMES.find(entry => entry.name === name);
  if (theme === undefined) throw new Error(`No theme ${name}`);
  return nextTextOf(theme, {texts: {}, auto: {}, ...content}, first);
}

describe('what the slide before shows', () => {
  it('names the song of a title slide, with its label when it has one', () => {
    expect(
      next(
        '찬양 제목',
        {texts: {제목: '빛의 길'}, auto: {이름표: '전주'}},
        true,
      ),
    ).toBe('다음 곡: 빛의 길 (전주)');
    expect(next('찬양 제목', {texts: {제목: '빛의 길'}}, true)).toBe(
      '다음 곡: 빛의 길',
    );
  });

  it('shows the lyrics with their label inside a song', () => {
    expect(
      next('찬양 가사', {
        texts: {가사: '맑은 아침'},
        auto: {이름표: '1절', '새 이름표': '1절'},
      }),
    ).toBe('(1절) 맑은 아침');
    expect(next('찬양 가사', {auto: {이름표: '간주'}})).toBe('(간주)');
    expect(next('찬양 가사', {})).toBe('(없음)');
  });

  it('names a song that starts without a title slide', () => {
    const auto = {'곡 제목': '빛의 길'};
    expect(next('찬양 가사', {texts: {가사: '맑은 아침'}, auto}, true)).toBe(
      '다음 곡: 빛의 길\n맑은 아침',
    );
    expect(next('찬양 가사', {auto: {...auto, 이름표: '전주'}}, true)).toBe(
      '다음 곡: 빛의 길 (전주)',
    );
  });

  it('names what comes next in the service', () => {
    expect(next('설교 제목', {texts: {제목: '동행의 열매 : 온유'}}, true)).toBe(
      '다음 순서: 설교 (동행의 열매 : 온유)',
    );
    expect(next('타이틀', {texts: {제목: '사도신경'}}, true)).toBe(
      '다음 순서: 사도신경',
    );
    expect(next('광고', {texts: {제목: '영성훈련'}})).toBe(
      '다음 광고: 영성훈련',
    );
  });

  it('shows the text of a passage, and nothing for 대기 화면', () => {
    expect(
      next('말씀 본문', {
        texts: {본문: '29 나는 마음이'},
        auto: {구절: '마태복음 11:29~30'},
      }),
    ).toBe('29 나는 마음이');
    expect(next('대기 화면', {})).toBeNull();
  });

  it('shows the text typed on the slide instead', () => {
    expect(
      next(
        '타이틀',
        {texts: {제목: '사도신경'}, next: '다 함께 사도신경'},
        true,
      ),
    ).toBe('다 함께 사도신경');
    expect(next('타이틀', {texts: {제목: '사도신경'}, next: ' '}, true)).toBe(
      '다음 순서: 사도신경',
    );
  });
});
