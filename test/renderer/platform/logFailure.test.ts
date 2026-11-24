import {describe, expect, it, vi} from 'vitest';
import {logFailure} from '@renderer/platform/logFailure';

describe('logFailure', () => {
  it('writes an error with the message and the cause', () => {
    const write = vi.fn();
    const error = new Error('disk full');

    logFailure({log: {write}}, 'Could not save', error);
    logFailure({log: {write}}, 'Could not read', 'offline');

    expect(write.mock.calls).toEqual([
      [{level: 'error', message: 'Could not save', detail: error.stack}],
      [{level: 'error', message: 'Could not read', detail: 'offline'}],
    ]);
  });

  it('writes nothing without the app API', () => {
    expect(() => logFailure(undefined, 'Could not save', 'x')).not.toThrow();
  });
});
