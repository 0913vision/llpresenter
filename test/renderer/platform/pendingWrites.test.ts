import {describe, expect, it, vi} from 'vitest';
import {
  PendingWrites,
  pendingWritesOf,
  type DraftOutcome,
} from '@renderer/platform/pendingWrites';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return {promise, resolve, reject};
}

const write = (promise: Promise<boolean>) => ({
  write: () => promise,
  refused: false,
  sent: (sent: boolean) => sent,
});

describe('pending writes', () => {
  it('lets each draft ask in turn before writing stops and ends at a cancel', async () => {
    const writes = new PendingWrites();
    const asked: string[] = [];
    const draft = (name: string, outcome: DraftOutcome) => () => {
      asked.push(`${name}:${writes.isStopped ? 'stopped' : 'open'}`);
      return Promise.resolve(outcome);
    };
    writes.addDraft(draft('first', 'settled'), vi.fn());
    const remove = writes.addDraft(draft('second', 'canceled'), vi.fn());
    writes.addDraft(draft('third', 'settled'), vi.fn());
    await expect(writes.settleDrafts()).resolves.toBe('canceled');
    expect(asked).toEqual(['first:open', 'second:open']);
    remove();
    await expect(writes.settleDrafts()).resolves.toBe('settled');
  });

  it('reports a draft that throws to its handler and answers failed', async () => {
    const writes = new PendingWrites();
    const onError = vi.fn();
    const failure = new Error('Invented draft failure');
    writes.addDraft(() => Promise.reject(failure), onError);
    await expect(writes.settleDrafts()).resolves.toBe('failed');
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
  });

  it('forgets a draft that was unregistered', async () => {
    const writes = new PendingWrites();
    const settle = vi.fn().mockResolvedValue('settled');
    writes.addDraft(settle, vi.fn())();
    await expect(writes.settleDrafts()).resolves.toBe('settled');
    expect(settle).not.toHaveBeenCalled();
  });

  it('waits for running writes at the flush and answers whether all were sent', async () => {
    const writes = new PendingWrites();
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    const running = [
      writes.run(write(first.promise)),
      writes.run(write(second.promise)).catch(() => false),
    ];
    let answered: boolean | undefined;
    const flushing = writes.flush().then(sent => {
      answered = sent;
    });
    first.resolve(true);
    await Promise.resolve();
    expect(answered).toBeUndefined();
    second.reject(new Error('Invented read failure'));
    await flushing;
    expect(answered).toBe(false);
    expect(await Promise.all(running)).toEqual([true, false]);
  });

  it('answers true with nothing running, and also when every write was sent', async () => {
    const writes = new PendingWrites();
    expect(await writes.flush()).toBe(true);
    writes.resume();
    const running = writes.run(write(Promise.resolve(true)));
    expect(await writes.flush()).toBe(true);
    expect(await running).toBe(true);
  });

  it('refuses new writes while stopped and runs them again after resume', async () => {
    const writes = new PendingWrites();
    const changed = vi.fn();
    writes.subscribe(changed);
    await writes.flush();
    expect(writes.isStopped).toBe(true);
    const task = vi.fn(() => Promise.resolve(true));
    expect(await writes.run({write: task, refused: false, sent: s => s})).toBe(
      false,
    );
    expect(task).not.toHaveBeenCalled();
    writes.resume();
    expect(await writes.run({write: task, refused: false, sent: s => s})).toBe(
      true,
    );
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('shares one gate per window API', () => {
    const api = {};
    expect(pendingWritesOf(api)).toBe(pendingWritesOf(api));
    expect(pendingWritesOf({})).not.toBe(pendingWritesOf(api));
  });
});
