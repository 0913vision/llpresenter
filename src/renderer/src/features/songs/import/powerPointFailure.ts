import type {PowerPointFailure} from '@core/schema/songs/powerpointImport';

/** What an import was making when PowerPoint failed. */
export type PowerPointWork = 'slides' | 'backgrounds';

const WORK_NAMES: Readonly<Record<PowerPointWork, string>> = {
  slides: '슬라이드 그림',
  backgrounds: '배경',
};

/**
 * The card of a PowerPoint failure, the same for "곡 가져오기" and "이미지로
 * 가져오기": what could not be made and why, and what the operator can do.
 * A PowerPoint the app started and left behind is ended by the app, so one
 * that does not answer is one the operator has open (church Nov 25: a hung
 * PowerPoint blocked a hymn until a reboot).
 */
export function powerPointFailureCard(
  failure: PowerPointFailure,
  work: PowerPointWork,
): {readonly title: string; readonly meta: string} {
  const name = WORK_NAMES[work];
  switch (failure) {
    case 'unresponsive':
      return {
        title: `PowerPoint가 응답하지 않아 ${name}을 가져오지 못했습니다.`,
        meta: '열린 PowerPoint의 대화 상자를 닫거나 PowerPoint를 모두 닫은 뒤 다시 가져와야 합니다.',
      };
    case 'unavailable':
      return {
        title: `PowerPoint가 없어 ${name}을 가져오지 못했습니다.`,
        meta:
          work === 'backgrounds'
            ? '가사는 그대로 가져왔습니다.'
            : 'PowerPoint가 설치된 PC에서 가져와야 합니다.',
      };
  }
}
