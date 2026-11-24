import {describe, expect, it, vi} from 'vitest';
import {followLatest} from '@core/common/followLatest';

function source<T>() {
  let listener: ((value: T) => void) | undefined;
  let answer: {resolve: (value: T) => void; reject: (cause: unknown) => void};
  const read = new Promise<T>((resolve, reject) => {
    answer = {resolve, reject};
  });
  const unsubscribe = vi.fn();
  return {
    read: () => read,
    subscribe: (next: (value: T) => void) => {
      listener = next;
      return unsubscribe;
    },
    push: (value: T) => listener?.(value),
    answer: (value: T) => answer.resolve(value),
    fail: (cause: unknown) => answer.reject(cause),
    unsubscribe,
  };
}

describe('followLatest', () => {
  it('applies the first read, then every push', async () => {
    const main = source<number>();
    const apply = vi.fn();
    followLatest(main, {apply});

    main.answer(1);
    await Promise.resolve();
    main.push(2);

    expect(apply.mock.calls).toEqual([[1], [2]]);
  });

  it('drops a read that answers after a push, which is newer', async () => {
    const main = source<number>();
    const apply = vi.fn();
    followLatest(main, {apply});

    main.push(2);
    main.answer(1);
    await Promise.resolve();

    expect(apply.mock.calls).toEqual([[2]]);
  });

  it('reports a failed read with whether a push had come', async () => {
    const main = source<number>();
    const failed = vi.fn();
    followLatest(main, {apply: vi.fn(), failed});

    main.push(2);
    main.fail(new Error('offline'));
    await Promise.resolve();
    await Promise.resolve();

    expect(failed).toHaveBeenCalledWith(new Error('offline'), true);
  });

  it('applies and reports nothing after it stops, and unsubscribes', async () => {
    const main = source<number>();
    const apply = vi.fn();
    const failed = vi.fn();
    const stop = followLatest(main, {apply, failed});

    stop();
    main.push(2);
    main.fail(new Error('late'));
    await Promise.resolve();
    await Promise.resolve();

    expect(apply).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    expect(main.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
