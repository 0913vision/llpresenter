import {expect, it} from 'vitest';
import {limitReason} from '@core/common/limitReason';

it('says the one limit sentence with the right topic particle', () => {
  expect(limitReason('테마', 200)).toBe('테마는 200개까지 추가할 수 있음');
  expect(limitReason('요소', 10)).toBe('요소는 10개까지 추가할 수 있음');
  expect(limitReason('동작', 256)).toBe('동작은 256개까지 추가할 수 있음');
  expect(limitReason('메시지 문구', 100)).toBe(
    '메시지 문구는 100개까지 추가할 수 있음',
  );
});

it('takes another verb for what the limit is about', () => {
  expect(limitReason('타이머', 200, '시작')).toBe(
    '타이머는 200개까지 시작할 수 있음',
  );
});
