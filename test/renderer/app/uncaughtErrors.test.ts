import {describe, expect, it, vi} from 'vitest';
import {logUncaughtErrors} from '@renderer/app/uncaughtErrors';

describe('logUncaughtErrors', () => {
  it('logs an uncaught error and an unhandled rejection of the window until stopped', () => {
    const write = vi.fn();
    const stop = logUncaughtErrors({log: {write}}, 'control window');
    const error = new Error('panel broke');

    window.dispatchEvent(new ErrorEvent('error', {error, message: 'x'}));
    const rejection = new Event('unhandledrejection');
    Object.assign(rejection, {reason: 'service lost'});
    window.dispatchEvent(rejection);
    stop();
    window.dispatchEvent(new ErrorEvent('error', {message: 'after'}));

    expect(write.mock.calls).toEqual([
      [
        {
          level: 'error',
          message: 'uncaught error in the control window',
          detail: error.stack,
        },
      ],
      [
        {
          level: 'error',
          message: 'unhandled rejection in the control window',
          detail: 'service lost',
        },
      ],
    ]);
  });

  it('does nothing without the app API', () => {
    expect(() =>
      logUncaughtErrors(undefined, 'control window')(),
    ).not.toThrow();
  });
});
