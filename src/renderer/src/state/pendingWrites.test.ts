import {describe, expect, it, vi} from 'vitest';
import {PendingWrites, pendingWritesOf} from './pendingWrites';

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
