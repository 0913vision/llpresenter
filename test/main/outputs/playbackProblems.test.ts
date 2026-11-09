import {describe, expect, it, vi} from 'vitest';
import {PlaybackProblemBoard} from '@main/outputs/playbackProblems';

vi.mock('@main/ipc', () => ({
  answerWindows: vi.fn(),
  listenToWindows: vi.fn(),
  sendToWindows: vi.fn(),
}));

function setup() {
  const enabled = new Set(['screen', 'audio']);
  const changed = vi.fn();
  const retry = vi.fn();
  const board = new PlaybackProblemBoard(
    source => enabled.has(source),
    changed,
  );
  const release = board.register(10, {
    source: 'screen',
    name: () => '청중 화면',
    retry,
  });
  return {board, changed, enabled, release, retry};
}

describe('PlaybackProblemBoard', () => {
  it('accepts only registered senders, retains current state for a reloaded control, and deduplicates reports', () => {
    const {board, changed} = setup();
    board.report(99, ['playback']);
    expect(board.snapshot()).toEqual([]);
    board.report(10, ['playback']);
    board.report(10, ['playback']);
    expect(changed).toHaveBeenCalledOnce();
    expect(board.snapshot()).toEqual([
      {
        source: 'screen',
        name: '청중 화면',
        kinds: ['playback'],
        renderer: 'running',
      },
    ]);
    board.report(10, []);
    expect(changed).toHaveBeenLastCalledWith([]);
  });

  it('hides off-screen failures, restores unresolved ones on enable, and retires a destroyed source', () => {
    const {board, changed, enabled, release, retry} = setup();
    board.report(10, ['playback']);
    enabled.delete('screen');
    board.refresh();
    expect(changed).toHaveBeenLastCalledWith([]);
    board.retry('screen');
    expect(retry).not.toHaveBeenCalled();
    enabled.add('screen');
    board.refresh();
    expect(board.snapshot()).toHaveLength(1);
    board.retry('screen');
    expect(retry).toHaveBeenCalledOnce();
    release();
    board.report(10, ['playback']);
    expect(board.snapshot()).toEqual([]);
  });

  it('keeps audio restart exhaustion until recovery and preserves independent failures', () => {
    const {board} = setup();
    board.register(20, {source: 'audio', name: () => '오디오', retry: vi.fn()});
    board.report(10, ['playback']);
    board.renderer(20, 'limited');
    expect(board.snapshot().find(row => row.source === 'audio')?.renderer).toBe(
      'limited',
    );
    board.renderer(20, 'running');
    expect(board.snapshot().map(row => row.source)).toEqual(['screen']);
  });
});
