import {describe, expect, it, vi} from 'vitest';
import {failureDetail, logFailure} from '@renderer/platform/logFailure';

describe('logFailure', () => {
  it('writes an error with the message and what the cause says', () => {
    const write = vi.fn();

    logFailure({log: {write}}, 'Could not save', new Error('disk full'));
    logFailure({log: {write}}, 'Could not read', 'offline');

    expect(write.mock.calls).toEqual([
      [{level: 'error', message: 'Could not save', detail: 'disk full'}],
      [{level: 'error', message: 'Could not read', detail: 'offline'}],
    ]);
  });

  it('writes nothing without the app API', () => {
    expect(() => logFailure(undefined, 'Could not save', 'x')).not.toThrow();
  });

  it('reads an error by its message and anything else as text', () => {
    expect(failureDetail(new TypeError('bad'))).toBe('bad');
    expect(failureDetail(42)).toBe('42');
  });
});
