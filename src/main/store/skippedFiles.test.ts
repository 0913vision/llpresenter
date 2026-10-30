import {describe, expect, it, vi} from 'vitest';
import {APP_PROBLEM_LIMITS, type AppProblem} from '@core/schema/appProblem';
import {recordingLogger} from '../displays/testing';
import {
  SkippedFiles,
  startSkippedFileProblems,
  type SkippedFile,
} from './skippedFiles';

const LOOKS = 'D:/data/settings/looks.json';
const SONG = 'D:/data/Songs/a1.llsong';

function settingsFeed() {
  const listeners = new Set<(skipped: SkippedFile) => void>();
  return {
    subscribe: (listener: (skipped: SkippedFile) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    report: (file: string) => {
      for (const listener of listeners) listener({file});
    },
    get size() {
      return listeners.size;
    },
  };
}

describe('SkippedFiles', () => {
  it('keeps each skipped file once, with its own id and its file name', () => {
    const skipped = new SkippedFiles(recordingLogger());
    expect(skipped.addSkippedFile(LOOKS)).toEqual({
      kind: 'file-skipped',
      fileId: 1,
      name: 'looks.json',
    });
    expect(skipped.addSkippedFile(LOOKS)).toBeNull();
    expect(skipped.addSkippedFile('D:/backup/settings/looks.json')).toEqual({
      kind: 'file-skipped',
      fileId: 2,
      name: 'looks.json',
    });
    expect(skipped.list()).toEqual([
      {kind: 'file-skipped', fileId: 1, name: 'looks.json'},
      {kind: 'file-skipped', fileId: 2, name: 'looks.json'},
    ]);
  });

  it('lists at most the limit and logs the overflow once', () => {
    const log = recordingLogger();
    const skipped = new SkippedFiles(log);
    for (let index = 0; index < APP_PROBLEM_LIMITS.listed + 3; index += 1) {
      skipped.addSkippedFile(`D:/data/Songs/${index}.llsong`);
    }
    expect(skipped.list()).toHaveLength(APP_PROBLEM_LIMITS.listed);
    expect(log.messages('warn')).toEqual([
      'too many skipped data files to list',
    ]);
  });
});

describe('startSkippedFileProblems', () => {
  it('announces each skipped settings and content file once', async () => {
    const feed = settingsFeed();
    const announce = vi.fn<(problem: AppProblem) => void>();
    const skipped = new SkippedFiles(recordingLogger());
    startSkippedFileProblems({
      skipped,
      sources: {
        settings: feed.subscribe,
        content: Promise.resolve([{file: SONG}, {file: LOOKS}]),
      },
      announce,
      log: recordingLogger(),
    });
    feed.report(LOOKS);
    await Promise.resolve();
    expect(announce.mock.calls.map(([problem]) => problem)).toEqual([
      {kind: 'file-skipped', fileId: 1, name: 'looks.json'},
      {kind: 'file-skipped', fileId: 2, name: 'a1.llsong'},
    ]);
    expect(skipped.list()).toHaveLength(2);
  });

  it('stops listening and ignores a late content read after stop', async () => {
    const feed = settingsFeed();
    const announce = vi.fn<(problem: AppProblem) => void>();
    let finish: (skipped: readonly SkippedFile[]) => void = () => undefined;
    const stop = startSkippedFileProblems({
      skipped: new SkippedFiles(recordingLogger()),
      sources: {
        settings: feed.subscribe,
        content: new Promise(resolve => {
          finish = resolve;
        }),
      },
      announce,
      log: recordingLogger(),
    });
    stop();
    expect(feed.size).toBe(0);
    finish([{file: SONG}]);
    await Promise.resolve();
    expect(announce).not.toHaveBeenCalled();
  });

  it('logs a failed content read and keeps the settings feed', async () => {
    const feed = settingsFeed();
    const announce = vi.fn<(problem: AppProblem) => void>();
    const log = recordingLogger();
    startSkippedFileProblems({
      skipped: new SkippedFiles(log),
      sources: {
        settings: feed.subscribe,
        content: Promise.reject(new Error('Invented read failure')),
      },
      announce,
      log,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(log.messages('error')).toEqual([
      'could not list the skipped data files',
    ]);
    feed.report(LOOKS);
    expect(announce).toHaveBeenCalledOnce();
  });
});
