import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  REPORT_INTERVAL_MS,
  startFrameRateMeter,
} from '@renderer/output/frameRateMeter';

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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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
    stop.stop();
    expect(frames.cancelled).toHaveLength(1);
  });

  it('reports idle health without requesting frames and restarts a fresh measurement for motion', () => {
    const frames = manualFrames();
    const requestFrame = vi.fn(frames.requestFrame);
    const report = vi.fn();
    const reportIdle = vi.fn();
    let active = false;
    const meter = startFrameRateMeter({
      ...frames,
      requestFrame,
      report,
      reportIdle,
      active: () => active,
    });
    vi.advanceTimersByTime(3000);
    expect(requestFrame).not.toHaveBeenCalled();
    expect(reportIdle).toHaveBeenCalledTimes(3);
    expect(report).not.toHaveBeenCalled();
    active = true;
    meter.refresh();
    frames.drawSteadily(40, 1100, 3000);
    expect(report).toHaveBeenLastCalledWith(40);
    active = false;
    meter.refresh();
    const requested = requestFrame.mock.calls.length;
    vi.advanceTimersByTime(5000);
    expect(requestFrame).toHaveBeenCalledTimes(requested);
    active = true;
    meter.refresh();
    frames.drawSteadily(60, 1100, 10000);
    expect(report).toHaveBeenLastCalledWith(60);
    meter.stop();
    const idleCount = reportIdle.mock.calls.length;
    vi.advanceTimersByTime(3000);
    expect(reportIdle).toHaveBeenCalledTimes(idleCount);
  });

  it('does not mask stalled moving frames with an idle heartbeat', () => {
    const reportIdle = vi.fn();
    const meter = startFrameRateMeter({
      ...manualFrames(),
      report: vi.fn(),
      reportIdle,
      active: () => true,
    });
    vi.advanceTimersByTime(10000);
    expect(reportIdle).not.toHaveBeenCalled();
    meter.stop();
  });

  it('reports health at the end of short motion bursts that cannot complete a FPS period', () => {
    const frames = manualFrames();
    const report = vi.fn();
    const reportIdle = vi.fn();
    let active = true;
    const meter = startFrameRateMeter({
      ...frames,
      report,
      reportIdle,
      active: () => active,
    });
    for (let index = 0; index < 6; index += 1) {
      frames.drawSteadily(60, 400, index * 1000);
      active = false;
      meter.refresh();
      expect(reportIdle).toHaveBeenCalledTimes(index + 1);
      active = true;
      meter.refresh();
    }
    expect(report).not.toHaveBeenCalled();
    meter.stop();
  });
});
