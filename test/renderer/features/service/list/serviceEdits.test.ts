import {describe, expect, it} from 'vitest';
import type {EditResult} from '@core/schema/services/contentEdit';
import {
  appliedId,
  asServiceId,
  editApplied,
} from '@renderer/features/service/list/serviceEdits';

const SERVICE = '5f05195b-33c3-4ac4-8b57-9dfcd717a17a';
const saved: EditResult = {ok: true, value: {id: SERVICE, revision: 2}};
const unwritten: EditResult = {
  ok: false,
  error: {
    reason: 'write-failed',
    message: 'Invented disk failure',
    applied: {id: SERVICE, revision: 2},
    unchangedFiles: ['주일 예배.llservice'],
  },
};
const refused: EditResult = {
  ok: false,
  error: {reason: 'stale', message: 'Invented newer revision'},
};

describe('the result of an edit of the service list', () => {
  it('counts an edit main keeps to save later as done, and a refusal as not', () => {
    expect(editApplied(saved)).toBe(true);
    expect(editApplied(unwritten)).toBe(true);
    expect(editApplied(refused)).toBe(false);
  });

  it('gives the id the edit made or changed only when it took effect', () => {
    expect(appliedId(saved)).toBe(SERVICE);
    expect(appliedId(unwritten)).toBe(SERVICE);
    expect(appliedId(refused)).toBeNull();
  });

  it('takes a 예배 순서 id and nothing else', () => {
    expect(asServiceId(SERVICE)).toBe(SERVICE);
    expect(asServiceId('library:song')).toBeNull();
    expect(asServiceId(null)).toBeNull();
  });
});
