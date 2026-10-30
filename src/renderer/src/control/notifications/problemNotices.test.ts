import {expect, it, vi} from 'vitest';
import {parseMacroId} from '@core/schema/ids';
import {expectSuccess} from '@core/schema/testHelpers';
import {saveFailedProblem} from '@core/schema/appProblem';
import {
  macroDroppedCard,
  skippedFilesCard,
  waitingSavesCard,
} from './problemNotices';

const TIME = '11:27';
const MACRO_ID = expectSuccess(
  parseMacroId('c63a2e74-9a31-4c4d-8e5f-607182930415'),
);

it('names one skipped file and says it was skipped', () => {
  expect(skippedFilesCard(['looks.json'], TIME)).toEqual({
    key: 'file-skipped',
    kind: 'warning',
    icon: 'filex',
    title: '파일을 읽을 수 없음',
    time: TIME,
    meta: ['looks.json', '건너뜀'],
  });
});

it('names the first skipped file and counts the others', () => {
  expect(
    skippedFilesCard(['looks.json', 'a1.llsong', 'b2.llsong'], TIME)?.meta,
  ).toEqual(['looks.json 외 2개', '건너뜀']);
});

it('gives no card when no file was skipped', () => {
  expect(skippedFilesCard([], TIME)).toBeNull();
});

it('warns that a 매크로 was not applied, keyed by the 매크로', () => {
  expect(
    macroDroppedCard(
      {kind: 'macro-dropped', macroId: MACRO_ID, name: '예배 시작'},
      TIME,
    ),
  ).toEqual({
    key: `macro-dropped:${MACRO_ID}`,
    kind: 'warning',
    icon: 'macro',
    title: '매크로 적용 실패',
    time: TIME,
    meta: ['예배 시작'],
  });
});

it('names a 매크로 without a name', () => {
  expect(
    macroDroppedCard({kind: 'macro-dropped', macroId: MACRO_ID, name: ''}, TIME)
      .meta,
  ).toEqual(['이름 없는 매크로']);
});

it('says one file cannot be saved, with 다시 시도', () => {
  const retry = vi.fn();
  const card = waitingSavesCard(saveFailedProblem('주일 예배', 1), {
    time: TIME,
    retry,
  });
  expect(card).toMatchObject({
    key: 'save-failed',
    kind: 'warning',
    icon: 'warning',
    title: '저장할 수 없음',
    time: TIME,
    meta: ['주일 예배'],
  });
  expect(card.actions?.map(action => action.label)).toEqual(['다시 시도']);
  card.actions?.[0]?.onSelect();
  expect(retry).toHaveBeenCalledOnce();
});

it('names the oldest waiting file and counts the others', () => {
  expect(
    waitingSavesCard(saveFailedProblem('주일 예배', 3), {
      time: TIME,
      retry: () => undefined,
    }).meta,
  ).toEqual(['주일 예배 외 2개']);
});
