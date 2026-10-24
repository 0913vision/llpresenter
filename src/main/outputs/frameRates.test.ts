import {describe, expect, it} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {FPS_SETTLE_MS, FrameRateTracker, TARGET_FPS} from './frameRates';

const LOW_FPS = 41;
const REPORT_EVERY_MS = 1000;

function setUp() {
  let time = 0;
  const log = recordingLogger();
  const tracker = new FrameRateTracker(
    screenId => screenId === 'main',
    log,
    () => time,
  );
  const reportFor = (fps: number, milliseconds: number): void => {
    for (let elapsed = 0; elapsed <= milliseconds; elapsed += REPORT_EVERY_MS) {
      tracker.report({screenId: 'main', fps});
      time += REPORT_EVERY_MS;
    }
  };
  return {tracker, log, reportFor};
}

describe('FrameRateTracker', () => {
  it('keeps the last rate of each screen', () => {
    const {tracker} = setUp();
    tracker.report({screenId: 'main', fps: 59.8});
    expect(tracker.current('main')).toEqual({fps: 59.8, status: 'normal'});
  });

  it('turns low only after the rate stays low for 2 seconds', () => {
    const {tracker, log, reportFor} = setUp();
    reportFor(LOW_FPS, FPS_SETTLE_MS - REPORT_EVERY_MS);
    expect(tracker.current('main')?.status).toBe('normal');
    reportFor(LOW_FPS, 0);
    expect(tracker.current('main')?.status).toBe('low');
    expect(log.messages('warn')).toEqual(['output frame rate low']);
  });

  it('ignores a single slow second', () => {
    const {tracker, log, reportFor} = setUp();
    reportFor(LOW_FPS, 0);
    reportFor(TARGET_FPS, FPS_SETTLE_MS * 2);
    expect(tracker.current('main')?.status).toBe('normal');
    expect(log.entries).toEqual([]);
  });

  it('returns to normal after 2 seconds back at the target', () => {
    const {tracker, log, reportFor} = setUp();
    reportFor(LOW_FPS, FPS_SETTLE_MS);
    reportFor(TARGET_FPS, FPS_SETTLE_MS - REPORT_EVERY_MS);
    expect(tracker.current('main')?.status).toBe('low');
    reportFor(TARGET_FPS, 0);
    expect(tracker.current('main')?.status).toBe('normal');
    expect(log.messages('info')).toEqual([
      'output frame rate back at the target',
    ]);
  });

  it('ignores reports for screens that do not exist', () => {
    const {tracker} = setUp();
    tracker.report({screenId: 'nowhere', fps: 60});
    expect(tracker.current('nowhere')).toBeNull();
  });

  it('stays low at a rate that is no longer low but still under the target', () => {
    const {tracker, reportFor} = setUp();
    reportFor(LOW_FPS, FPS_SETTLE_MS);
    reportFor(57, FPS_SETTLE_MS * 3);
    expect(tracker.current('main')?.status).toBe('low');
    reportFor(59.8, FPS_SETTLE_MS);
    expect(tracker.current('main')?.status).toBe('normal');
  });

  it('never turns low at a rate a little under the target', () => {
    const {tracker, log, reportFor} = setUp();
    reportFor(56, FPS_SETTLE_MS * 3);
    expect(tracker.current('main')?.status).toBe('normal');
    expect(log.entries).toEqual([]);
  });
});
