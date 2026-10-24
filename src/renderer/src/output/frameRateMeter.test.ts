import {describe, expect, it, vi} from 'vitest';
import {REPORT_INTERVAL_MS, startFrameRateMeter} from './frameRateMeter';

function manualFrames() {
  let pending: FrameRequestCallback | null = null;
  let next = 1;
  const cancelled: number[] = [];
  return {
    requestFrame: (callback: FrameRequestCallback): number => {
      pending = callback;
      next += 1;
      return next;
    },
    cancelFrame: (handle: number): void => {
      cancelled.push(handle);
    },
    drawSteadily(fps: number, milliseconds: number, from = 0): void {
      const step = 1000 / fps;
      for (let time = from; time <= from + milliseconds; time += step) {
        pending?.(time);
      }
    },
    cancelled,
  };
}

describe('startFrameRateMeter', () => {
  it('reports the frame rate once a second', () => {
    const frames = manualFrames();
    const report = vi.fn<(fps: number) => void>();
    startFrameRateMeter({report, ...frames});
    frames.drawSteadily(60, REPORT_INTERVAL_MS * 2 + 100);
    expect(report.mock.calls.map(([fps]) => fps)).toEqual([60, 60]);
  });

  it('reports a dropped rate', () => {
    const frames = manualFrames();
    const report = vi.fn<(fps: number) => void>();
    startFrameRateMeter({report, ...frames});
    frames.drawSteadily(41, REPORT_INTERVAL_MS + 30);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0]?.[0]).toBeCloseTo(41, 0);
  });

  it('stops asking for frames when stopped', () => {
    const frames = manualFrames();
    const stop = startFrameRateMeter({report: vi.fn(), ...frames});
    stop();
    expect(frames.cancelled).toHaveLength(1);
  });
});
