import {describe, expect, it} from 'vitest';
import type {Label} from '@shared/schema/labels';
import {
  arrangementNameReason,
  DUPLICATE_ARRANGEMENT_NAME_REASON,
  EMPTY_ARRANGEMENT_NAME_REASON,
  MISSING_ARRANGEMENT_REASON,
  RESERVED_ARRANGEMENT_NAME_REASON,
} from './ArrangementDialog';
import {
  DUPLICATE_LABEL_NAME_REASON,
  EMPTY_LABEL_NAME_REASON,
  JUMP_KEY_REASON,
  labelNameReason,
} from './LabelDialog';

const REASON_SENTENCE = /^[^.]+습니다$/u;

describe('arrangement name reasons', () => {
  const names = ['기본', '주일용', '저녁용'];

  it.each([
    ['', '주일용', EMPTY_ARRANGEMENT_NAME_REASON],
    ['   ', '주일용', EMPTY_ARRANGEMENT_NAME_REASON],
    [' 기본 ', '주일용', RESERVED_ARRANGEMENT_NAME_REASON],
    ['새 구성', '사라진 구성', MISSING_ARRANGEMENT_REASON],
    [' 저녁용 ', '주일용', DUPLICATE_ARRANGEMENT_NAME_REASON],
  ])('rejects %j renamed from %j', (value, from, reason) => {
    expect(arrangementNameReason(value, names, from)).toBe(reason);
  });

  it.each([
    [' 주일용 ', '주일용'],
    ['새벽용', '주일용'],
  ])('accepts %j renamed from %j', (value, from) => {
    expect(arrangementNameReason(value, names, from)).toBeUndefined();
  });
});

describe('label name reasons', () => {
  const labels: readonly Label[] = [{name: '후렴', color: 'none', key: null}];

  it.each([
    ['', EMPTY_LABEL_NAME_REASON],
    ['  ', EMPTY_LABEL_NAME_REASON],
    [' 후렴 ', DUPLICATE_LABEL_NAME_REASON],
  ])('rejects %j', (value, reason) => {
    expect(labelNameReason(value, labels)).toBe(reason);
  });

  it('accepts a new name', () => {
    expect(labelNameReason('브릿지', labels)).toBeUndefined();
  });
});

describe('editor name reasons', () => {
  it.each([
    EMPTY_ARRANGEMENT_NAME_REASON,
    RESERVED_ARRANGEMENT_NAME_REASON,
    MISSING_ARRANGEMENT_REASON,
    DUPLICATE_ARRANGEMENT_NAME_REASON,
    EMPTY_LABEL_NAME_REASON,
    DUPLICATE_LABEL_NAME_REASON,
    JUMP_KEY_REASON,
  ])('writes %j as one polite sentence without a period', reason => {
    expect(reason).toMatch(REASON_SENTENCE);
  });
});
