import {describe, expect, it} from 'vitest';
import type {Label} from '@core/schema/labels';
import {
  DUPLICATE_LABEL_NAME_REASON,
  EMPTY_LABEL_NAME_REASON,
  labelNameReason,
} from '@renderer/features/songs/editor/LabelNameField';

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
