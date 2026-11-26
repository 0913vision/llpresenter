import {EventEmitter} from 'node:events';
import {describe, expect, it, vi} from 'vitest';
import {
  PlaybackProblemBoard,
  watchPlaybackProblems,
} from '@main/outputs/health/playbackProblems';

vi.mock('electron', () => ({}));

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

  it('forgets an output whose page is gone, and once its watch is stopped', () => {
    const changed = vi.fn();
    const board = new PlaybackProblemBoard(() => true, changed);
    const page = Object.assign(new EventEmitter(), {id: 7});
    const source = {source: 'stage', name: () => '무대 화면', retry: vi.fn()};
    watchPlaybackProblems(board, page, source);
    board.report(7, ['device-missing']);
    expect(board.snapshot()).toHaveLength(1);
    page.emit('destroyed');
    expect(board.snapshot()).toEqual([]);
    const stopWatching = watchPlaybackProblems(board, page, source);
    board.report(7, ['device-missing']);
    stopWatching();
    expect(board.snapshot()).toEqual([]);
    expect(page.listenerCount('destroyed')).toBe(0);
  });

  it('takes no more outputs than the problem list holds', () => {
    const board = new PlaybackProblemBoard(() => true, vi.fn());
    const source = {source: 'screen', name: () => '청중 화면', retry: vi.fn()};
    expect(() => {
      for (let sender = 0; sender < 1000; sender++) {
        board.register(sender, source);
      }
    }).toThrow('Too many playback problem sources');
  });
});
