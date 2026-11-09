import {describe, expect, it, vi} from 'vitest';
import {
  followPlaybackProblems,
  setPlaybackProblem,
} from '@renderer/rendering/playbackProblem';

describe('followPlaybackProblems', () => {
  it('keeps simultaneous failures until every affected player recovers, without adding output text', () => {
    const root = document.createElement('div');
    const first = document.createElement('video');
    const second = document.createElement('audio');
    root.append(first, second);
    const report = vi.fn();
    const stop = followPlaybackProblems(root, report);
    setPlaybackProblem(first, 'playback', true);
    setPlaybackProblem(second, 'playback', true);
    setPlaybackProblem(first, 'playback', false);
    expect(report.mock.calls).toEqual([[[]], [['playback']]]);
    setPlaybackProblem(second, 'device-failed', true);
    setPlaybackProblem(second, 'playback', false);
    expect(report).toHaveBeenLastCalledWith(['device-failed']);
    setPlaybackProblem(second, 'device-failed', false);
    expect(report).toHaveBeenLastCalledWith([]);
    expect(root.textContent).toBe('');
    stop();
  });

  it('retires removed layers and ignores events after disposal', async () => {
    const root = document.createElement('div');
    const layer = document.createElement('div');
    root.append(layer);
    const report = vi.fn();
    const stop = followPlaybackProblems(root, report);
    setPlaybackProblem(layer, 'playback', true);
    layer.remove();
    await Promise.resolve();
    expect(report).toHaveBeenLastCalledWith([]);
    stop();
    report.mockClear();
    setPlaybackProblem(root, 'device-missing', true);
    expect(report).not.toHaveBeenCalled();
  });
});
