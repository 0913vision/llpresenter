import {describe, expect, it} from 'vitest';
import {recordingLogger} from './displays/testing';
import {FrameRateTracker} from './outputs/frameRates';
import {handleFrameRate, handleLogWrite} from './rendererMessages';

describe('handleLogWrite', () => {
  it("writes a window's line at its level with its detail", () => {
    const log = recordingLogger();
    handleLogWrite(log)({
      level: 'error',
      message: 'could not draw the lyrics layer',
      detail: 'Error: layout failed',
    });
    expect(log.entries).toEqual([
      {
        level: 'error',
        message: 'window: could not draw the lyrics layer',
        detail: 'Error: layout failed',
      },
    ]);
  });

  it.each([
    null,
    'text',
    {level: 'fatal', message: 'x'},
    {level: 'info', message: ''},
    {level: 'info', message: 'x'.repeat(501)},
  ])('drops a malformed entry: %j', value => {
    const log = recordingLogger();
    handleLogWrite(log)(value);
    expect(log.messages('warn')).toEqual([
      'dropped a malformed log entry from a window',
    ]);
    expect(log.messages('error')).toEqual([]);
  });
});

describe('handleFrameRate', () => {
  it('passes a valid report to the tracker', () => {
    const log = recordingLogger();
    const tracker = new FrameRateTracker(() => true, log);
    handleFrameRate(tracker, log)({screenId: 'main', fps: 59.9});
    expect(tracker.current('main')).toEqual({fps: 59.9, status: 'normal'});
  });

  it.each([
    {screenId: 'main', fps: Number.NaN},
    {screenId: '', fps: 60},
    {fps: 60},
  ])('drops a malformed report: %j', value => {
    const log = recordingLogger();
    const tracker = new FrameRateTracker(() => true, log);
    handleFrameRate(tracker, log)(value);
    expect(tracker.current('main')).toBeNull();
    expect(log.messages('warn')).toEqual([
      'dropped a malformed frame rate report',
    ]);
  });
});
