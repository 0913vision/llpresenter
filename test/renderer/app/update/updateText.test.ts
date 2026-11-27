import {expect, it} from 'vitest';
import {
  updateChoices,
  updateFacts,
  updateTitle,
} from '@renderer/app/update/updateText';

it('says the version, the step and the reason of a failed download', () => {
  expect(
    updateFacts(
      {kind: 'error', stage: 'download', version: '1.2.3', reason: 'network'},
      {outputsOn: false, asNotice: false},
    ),
  ).toEqual(['버전 1.2.3', '내려받기 실패', 'network']);
});

it('warns that the screens go off only for an update to take while they are on', () => {
  const warning = '업데이트 중 화면이 꺼지고 다시 시작하면 복원됩니다.';
  const offer = {kind: 'available', version: '1.2.3'} as const;
  expect(updateFacts(offer, {outputsOn: true, asNotice: false})).toEqual([
    warning,
  ]);
  expect(updateFacts(offer, {outputsOn: false, asNotice: false})).toEqual([]);
  expect(updateFacts(offer, {outputsOn: true, asNotice: true})).toEqual([]);
  expect(updateChoices(offer)).toEqual({
    label: '업데이트',
    action: 'download',
    later: true,
  });
});

it('reads the version aloud for its particle, as 0.231.2를 and 0.233.1을', () => {
  expect(updateTitle({kind: 'available', version: '0.231.2'})).toBe(
    '새 버전 0.231.2가 있습니다.',
  );
  expect(updateTitle({kind: 'available', version: '0.233.1'})).toBe(
    '새 버전 0.233.1이 있습니다.',
  );
  expect(updateTitle({kind: 'downloaded', version: '0.231.2'})).toBe(
    '새 버전 0.231.2를 설치하시겠습니까?',
  );
  expect(updateTitle({kind: 'latest', version: '0.233.0'})).toBe(
    '최신 버전 0.233.0을 사용하고 있습니다.',
  );
});
