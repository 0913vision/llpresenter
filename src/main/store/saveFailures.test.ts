import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import {APP_PROBLEM_LIMITS, type AppProblem} from '@shared/schema/appProblem';
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
    expect(failures.retry()).toBe(first);
    release();
    await first;
    expect(order).toEqual(['a', 'c']);
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
    const {failures, retry, wait} = setup();
    wait('a');
    await clock.advance(SAVE_RETRY_INTERVAL_MS - 1);
    expect(retry).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(retry).toHaveBeenCalledOnce();
    await clock.advance(SAVE_RETRY_INTERVAL_MS);
    expect(retry).toHaveBeenCalledTimes(2);
    failures.saved('a');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('caps the waiting files and logs the one it cannot keep', () => {
    const {failures, log, wait} = setup();
    for (let index = 0; index < APP_PROBLEM_LIMITS.waitingSaves; index++) {
      wait(`file-${index}`);
    }
    wait('one-more');
    wait('file-0');
    expect(failures.problems()).toEqual([
      {
        kind: 'save-failed',
        name: 'file-0',
        count: APP_PROBLEM_LIMITS.waitingSaves,
      },
    ]);
    expect(log.messages('error')).toEqual([
      'too many files wait for a save retry',
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
