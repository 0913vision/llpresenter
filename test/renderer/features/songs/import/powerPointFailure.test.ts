import {expect, it} from 'vitest';
import {powerPointFailureCard} from '@renderer/features/songs/import/powerPointFailure';

it('says what could not be made, why, and what to do when PowerPoint does not answer', () => {
  expect(powerPointFailureCard('unresponsive', 'backgrounds')).toEqual({
    title: 'PowerPoint가 응답하지 않아 배경을 가져오지 못했습니다.',
    meta: '열린 PowerPoint의 대화 상자를 닫거나 PowerPoint를 모두 닫은 뒤 다시 가져와야 합니다.',
  });
  expect(powerPointFailureCard('unresponsive', 'slides').title).toBe(
    'PowerPoint가 응답하지 않아 슬라이드 그림을 가져오지 못했습니다.',
  );
});

it('says the lyrics came in when only the backgrounds needed PowerPoint', () => {
  expect(powerPointFailureCard('unavailable', 'backgrounds').meta).toBe(
    '가사는 그대로 가져왔습니다.',
  );
  expect(powerPointFailureCard('unavailable', 'slides').meta).toBe(
    'PowerPoint가 설치된 PC에서 가져와야 합니다.',
  );
});
