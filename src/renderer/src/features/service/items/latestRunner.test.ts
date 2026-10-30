import {describe, expect, it} from 'vitest';
import {createLatestRunner} from './latestRunner';

function deferred() {
  let release: () => void = () => undefined;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return {promise, release};
}

describe('latest runner', () => {
  it('runs one task at a time and only the newest waiting task after it', async () => {
    const runner = createLatestRunner();
    const ran: string[] = [];
    const first = deferred();
    runner.submit(() => {
      ran.push('first');
      return first.promise;
    });
    runner.submit(() => {
      ran.push('second');
      return Promise.resolve();
    });
    runner.submit(() => {
      ran.push('third');
      return Promise.resolve();
    });
    expect(ran).toEqual(['first']);
    first.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(ran).toEqual(['first', 'third']);
  });

  it('runs the waiting task after a task fails', async () => {
    const runner = createLatestRunner();
    const ran: string[] = [];
    const first = deferred();
    runner.submit(async () => {
      await first.promise;
      throw new Error('Fixture failure');
    });
    runner.submit(() => {
      ran.push('next');
      return Promise.resolve();
    });
    first.release();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ran).toEqual(['next']);
  });
});
