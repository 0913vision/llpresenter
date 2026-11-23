import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LaunchTimes} from '@core/schema/launch';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {LaunchProgress} from '@main/application/launchProgress';

const bar = {advance: vi.fn(), end: vi.fn()};

function setup(launchTimes: LaunchTimes = {}) {
  const splash = {
    isDestroyed: vi.fn(() => false),
    close: vi.fn(),
  };
  const config = {launchTimes, setLaunchTimes: vi.fn()};
  const log = recordingLogger();
  const progress = new LaunchProgress({
    splash,
    openBar: () => bar,
    config,
    log,
  });
  const failed = vi.fn();
  progress.onFailure(failed);
  return {progress, splash, config, log, failed};
}

beforeEach(() => {
  vi.useRealTimers();
  bar.advance.mockClear();
  bar.end.mockClear();
});

describe('LaunchProgress', () => {
  it('logs when each task began and ended, once', () => {
    const {progress, log} = setup();
    progress.begin('files');
    progress.begin('files');
    progress.advance('files', 3, 7);
    progress.finish('files');
    progress.finish('files');
    expect(bar.advance).toHaveBeenCalledExactlyOnceWith('files', 3, 7);
    expect(bar.end).toHaveBeenCalledExactlyOnceWith('files', false);
    expect(log.messages('info')).toEqual([
      'launch task began',
      'launch task ended',
    ]);
  });

  it('tells in the log, on the bar and at the end what failed, and learns nothing from it', async () => {
    const {progress, log, failed, config} = setup();
    await expect(
      progress.track('media', Promise.reject(new Error('Invented failure'))),
    ).rejects.toThrow('Invented failure');
    expect(await progress.track('content', Promise.resolve(null))).toBeNull();
    expect(bar.end.mock.calls).toEqual([
      ['media', true],
      ['content', true],
    ]);
    expect(log.entries.filter(({level}) => level === 'error')).toMatchObject([
      {
        message: 'launch task failed',
        detail: {task: 'media', error: 'Invented failure'},
      },
      {detail: {task: 'content'}},
    ]);
    progress.end();
    expect(failed).toHaveBeenCalledExactlyOnceWith(['media', 'content']);
    expect(config.setLaunchTimes).not.toHaveBeenCalled();
  });

  it('warns about a task that took much longer than expected', () => {
    vi.useFakeTimers();
    const {progress, log} = setup({view: 100});
    progress.begin('view');
    vi.advanceTimersByTime(1300);
    progress.finish('view');
    expect(log.messages('warn')).toEqual(['launch task was slow']);
  });

  it('fails what is missing when it gives up', () => {
    const {progress, failed} = setup();
    progress.finish('files');
    progress.giveUp();
    progress.end();
    expect(failed.mock.calls[0]?.[0]).toContain('outputs');
    expect(failed.mock.calls[0]?.[0]).not.toContain('files');
  });

  it('closes the launch window once and keeps what the launch took for the next', () => {
    const {progress, splash, config} = setup({files: 100});
    progress.finish('files');
    progress.end();
    progress.end();
    expect(splash.close).toHaveBeenCalledOnce();
    expect(config.setLaunchTimes).toHaveBeenCalledOnce();
    expect(progress.report()[0]).toMatch(/^files: \d+ to \d+ ms/);
  });
});
