import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import type {AppProblem} from '@shared/schema/appProblem';
import {recordingLogger} from '../displays/testing';
import {SAVE_RETRY_INTERVAL_MS, SaveFailures} from './saveFailures';

function setup() {
  const log = recordingLogger();
  const failures = new SaveFailures({log});
  onTestFinished(() => {
    failures.dispose();
  });
  const pushed = vi.fn<(problem: AppProblem) => void>();
  failures.subscribe(pushed);
  const retry = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const wait = (file: string, name = file) => {
    failures.waiting({file, name, retry});
  };
  return {log, failures, pushed, retry, wait};
}

describe('save failures', () => {
  it('pushes the oldest file and the count on each change, then save-recovered', () => {
    const {failures, pushed, wait} = setup();
    wait('a.llsong', 'Invented hymn');
    wait('b.json');
    wait('a.llsong', 'Invented hymn');
    expect(failures.problems()).toEqual([
      {kind: 'save-failed', name: 'Invented hymn', count: 2},
    ]);
    failures.saved('a.llsong');
    failures.saved('missing.json');
    failures.saved('b.json');
    expect(pushed.mock.calls.map(([problem]) => problem)).toEqual([
      {kind: 'save-failed', name: 'Invented hymn', count: 1},
      {kind: 'save-failed', name: 'Invented hymn', count: 2},
      {kind: 'save-failed', name: 'b.json', count: 1},
      {kind: 'save-recovered'},
    ]);
    expect(failures.problems()).toEqual([]);
  });

  it('retries every waiting file once, oldest first, joining a retry that runs', async () => {
    const {failures, wait} = setup();
    const order: string[] = [];
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    failures.waiting({
      file: 'a',
      name: 'a',
      retry: async () => {
        order.push('a');
        await held;
      },
    });
    wait('b');
    failures.waiting({
      file: 'c',
      name: 'c',
      retry: () => {
        order.push('c');
        return Promise.reject(new Error('Invented disk failure'));
      },
    });
    const first = failures.retry();
    const second = failures.retry();
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['a', 'c']);
  });

  it('pushes the unchanged problem again after 다시 시도 while files still wait', async () => {
    const {failures, pushed, wait} = setup();
    wait('a');
    await failures.retry();
    expect(pushed.mock.calls.map(([problem]) => problem)).toEqual([
      {kind: 'save-failed', name: 'a', count: 1},
      {kind: 'save-failed', name: 'a', count: 1},
    ]);
    failures.saved('a');
    await failures.retry();
    expect(pushed).toHaveBeenCalledTimes(3);
    expect(pushed).toHaveBeenLastCalledWith({kind: 'save-recovered'});
  });

  it('logs a retry that throws and goes on with the next file', async () => {
    const {failures, log, retry} = setup();
    failures.waiting({
      file: 'a',
      name: 'a',
      retry: () => Promise.reject(new Error('Invented')),
    });
    failures.waiting({file: 'b', name: 'b', retry});
    await failures.retry();
    expect(retry).toHaveBeenCalledOnce();
    expect(log.messages('error')).toEqual(['could not retry a save']);
  });

  it('retries by itself every interval while files wait and stops when none do', async () => {
    const clock = installFakeClock();
    const {failures, pushed, retry, wait} = setup();
    wait('a');
    await clock.advance(SAVE_RETRY_INTERVAL_MS - 1);
    expect(retry).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(retry).toHaveBeenCalledOnce();
    await clock.advance(SAVE_RETRY_INTERVAL_MS);
    expect(retry).toHaveBeenCalledTimes(2);
    expect(pushed).toHaveBeenCalledOnce();
    failures.saved('a');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pushes the next file after an automatic pass moves the failing ones', async () => {
    const clock = installFakeClock();
    const {failures, pushed, retry, wait} = setup();
    for (const file of ['a', 'b', 'c', 'd', 'e']) wait(file);
    await clock.advance(SAVE_RETRY_INTERVAL_MS);
    await vi.waitFor(() => expect(retry).toHaveBeenCalledTimes(3));
    await clock.advance(0);
    const next = {kind: 'save-failed', name: 'd', count: 5};
    expect(failures.problems()).toEqual([next]);
    expect(pushed.mock.calls.slice(-2).map(([problem]) => problem)).toEqual([
      {kind: 'save-failed', name: 'a', count: 5},
      next,
    ]);
  });

  it('keeps every waiting file and recovers only when the last one is written', () => {
    const {failures, pushed, wait} = setup();
    const files = Array.from({length: 300}, (_, index) => `file-${index}`);
    for (const file of files) wait(file);
    expect(failures.problems()).toEqual([
      {kind: 'save-failed', name: 'file-0', count: 300},
    ]);
    for (const file of files.slice(0, -1)) failures.saved(file);
    expect(failures.problems()).toEqual([
      {kind: 'save-failed', name: 'file-299', count: 1},
    ]);
    expect(pushed).not.toHaveBeenLastCalledWith({kind: 'save-recovered'});
    failures.saved('file-299');
    expect(pushed).toHaveBeenLastCalledWith({kind: 'save-recovered'});
  });

  it('stops a pass after failures in a row and retries those files last next time', async () => {
    const {failures} = setup();
    const tried: string[] = [];
    for (const file of ['a', 'b', 'c', 'd', 'e']) {
      failures.waiting({
        file,
        name: file,
        retry: () => {
          tried.push(file);
          if (file === 'e') failures.saved(file);
          return Promise.resolve();
        },
      });
    }
    await failures.retry();
    expect(tried).toEqual(['a', 'b', 'c']);
    expect(failures.problems()).toEqual([
      {kind: 'save-failed', name: 'd', count: 5},
    ]);
    tried.length = 0;
    await failures.retry();
    expect(tried).toEqual(['d', 'e', 'a', 'b', 'c']);
    expect(failures.problems()).toEqual([
      {kind: 'save-failed', name: 'd', count: 4},
    ]);
  });

  it('leaves a file that starts waiting during a pass to the next one', async () => {
    const {failures} = setup();
    const tried: string[] = [];
    const add = (file: string, during?: () => void) => {
      failures.waiting({
        file,
        name: file,
        retry: () => {
          tried.push(file);
          during?.();
          return Promise.resolve();
        },
      });
    };
    add('a', () => {
      add('new');
    });
    add('b');
    await failures.retry();
    expect(tried).toEqual(['a', 'b']);
    tried.length = 0;
    await failures.retry();
    expect(tried).toEqual(['new', 'a', 'b']);
  });

  it('pushes save-failed again on remind only while files wait', () => {
    const {failures, pushed, wait} = setup();
    failures.remind();
    expect(pushed).not.toHaveBeenCalled();
    wait('a');
    failures.remind();
    expect(pushed.mock.calls.map(([problem]) => problem)).toEqual([
      {kind: 'save-failed', name: 'a', count: 1},
      {kind: 'save-failed', name: 'a', count: 1},
    ]);
  });

  it('keeps a failing listener from the others', () => {
    const {failures, log, pushed, wait} = setup();
    failures.subscribe(() => {
      throw new Error('Card failed');
    });
    wait('a');
    expect(pushed).toHaveBeenCalledOnce();
    expect(log.messages('error')).toEqual(['save problem listener failed']);
  });

  it('stops its timer, listeners, and new entries on dispose', () => {
    installFakeClock();
    const {failures, pushed, wait} = setup();
    wait('a');
    failures.dispose();
    expect(vi.getTimerCount()).toBe(0);
    wait('b');
    failures.saved('a');
    expect(pushed).toHaveBeenCalledOnce();
  });
});
