import {EventEmitter} from 'node:events';
import {expect, it, onTestFinished, vi} from 'vitest';
import {outputEndpoints} from '@contracts/ipc/output';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {
  PlaybackProblemBoard,
  registerPlaybackProblems,
  watchPlaybackProblems,
} from '@main/outputs/health/playbackProblems';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
const pushed = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({
  ipcMain: ipc.ipcMain,
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send: pushed},
      },
    ],
  },
}));

/** The sender id the fake ipcMain gives every call. */
const SENDER = 1;

function setUp() {
  const retry = vi.fn();
  let refresh: () => void = () => undefined;
  const unsubscribe = vi.fn();
  const enabled = new Set(['screen']);
  const {board, stop} = registerPlaybackProblems({
    log: recordingLogger(),
    enabled: source => enabled.has(source),
    subscribe: changed => {
      refresh = changed;
      return unsubscribe;
    },
  });
  onTestFinished(() => {
    stop();
    ipc.reset();
    pushed.mockReset();
  });
  board.register(SENDER, {source: 'screen', name: () => '청중 화면', retry});
  return {board, stop, retry, unsubscribe, enabled, refresh: () => refresh()};
}

it('takes a report from the output that sent it, tells the windows, and answers what is wrong now', async () => {
  setUp();
  ipc.send(outputEndpoints.playbackReport, ['media-missing']);
  const problems = [
    {
      source: 'screen',
      name: '청중 화면',
      kinds: ['media-missing'],
      renderer: 'running',
    },
  ];
  expect(pushed).toHaveBeenCalledWith(
    outputEndpoints.playbackChanged.channel,
    problems,
  );
  expect(await ipc.invoke(outputEndpoints.playbackProblems)).toEqual(problems);
});

it('asks the output to play again, and hides its problems while it is off', () => {
  const {retry, enabled, refresh} = setUp();
  ipc.send(outputEndpoints.playbackReport, ['playback']);
  ipc.send(outputEndpoints.playbackRetry, {source: 'screen'});
  expect(retry).toHaveBeenCalledOnce();
  enabled.delete('screen');
  refresh();
  expect(pushed).toHaveBeenLastCalledWith(
    outputEndpoints.playbackChanged.channel,
    [],
  );
  ipc.send(outputEndpoints.playbackRetry, {source: 'screen'});
  expect(retry).toHaveBeenCalledOnce();
});

it('stops answering and following the outputs once stopped', () => {
  const {stop, unsubscribe} = setUp();
  stop();
  expect(ipc.has(outputEndpoints.playbackProblems.channel)).toBe(false);
  expect(ipc.has(outputEndpoints.playbackReport.channel)).toBe(false);
  expect(unsubscribe).toHaveBeenCalledOnce();
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
