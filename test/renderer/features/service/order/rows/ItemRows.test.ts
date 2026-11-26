import {expect, it} from 'vitest';
import {createMediaId} from '@core/schema/common/ids';
import {problemTip} from '@renderer/features/service/order/rows/ItemRows';

const WARM = createMediaId('60000000-0000-4000-8000-000000000011');
const GONE = createMediaId('60000000-0000-4000-8000-000000000012');

function row(more: object = {}) {
  return {kind: 'blank' as const, id: 'item', title: '광고', ...more};
}

it('warns of a row whose background file this window knows is missing', () => {
  expect(problemTip(row({media: [WARM, GONE]}), new Set([GONE]))).toBe(
    '미디어 파일을 찾을 수 없습니다.',
  );
  expect(problemTip(row({media: [WARM]}), new Set([GONE]))).toBeUndefined();
  expect(problemTip(row({media: [GONE]}), null)).toBeUndefined();
});

it('keeps the problem main found, and warns of nothing on a section header', () => {
  expect(problemTip(row({problem: 'missing-song'}), new Set())).toBe(
    '곡 파일을 찾을 수 없습니다.',
  );
  expect(
    problemTip({kind: 'header', id: 'h', title: '찬양'}, new Set([GONE])),
  ).toBeUndefined();
});
