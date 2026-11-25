import {expect, it} from 'vitest';
import {updateChoices, updateFacts} from '@renderer/app/update/updateText';

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
