import {describe, expect, it, vi} from 'vitest';
import {BIBLE_AI_LIMITS, type BibleAiRequest} from '@core/schema/bibleAi';
import {ChooserQueue} from '@main/bible/llm/queue';
import {createChooser} from '@main/bible/llm/chooser';
import {startMockLlm} from '@fixtures/main/llmHttp';

function request(lookupId: string): BibleAiRequest {
  return {
    lookupId,
    fullText: 'one two',
    remaining: 'one two',
    candidates: ['one', 'one two'],
  };
}

describe('boundary chooser queue', () => {
  it('keeps complete two-way comparisons in FIFO order', async () => {
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const choose = vi.fn((value: BibleAiRequest) => {
      started.push(value.remaining);
      return new Promise<number>(resolve => releases.push(() => resolve(0)));
    });
    const queue = new ChooserQueue(choose);
    const first = queue.enqueue(1, request('first'));
    const second = queue.enqueue(1, {...request('second'), remaining: 'two'});
    expect(started).toEqual(['one two']);
    releases.shift()?.();
    expect(await first).toBe(0);
    await vi.waitFor(() => expect(started).toEqual(['one two', 'two']));
    releases.shift()?.();
    expect(await second).toBe(0);
    queue.stop();
  });

  it('aborts active HTTP and removes all waiting verses for only the cancelled window and lookup', async () => {
    let notify: () => void = () => undefined;
    const started = new Promise<void>(resolve => {
      notify = resolve;
    });
    let calls = 0;
    const {endpoint} = await startMockLlm((_request, response) => {
      calls++;
      if (calls === 1) notify();
      else response.end('{"content":"1"}');
    });
    const queue = new ChooserQueue((value, signal) =>
      createChooser({endpoint, signal})(
        value.fullText,
        value.remaining,
        value.candidates,
      ),
    );
    try {
      const active = queue
        .enqueue(1, request('old'))
        .catch((error: unknown) => error);
      const stale = queue
        .enqueue(1, request('old'))
        .catch((error: unknown) => error);
      const otherWindow = queue.enqueue(2, request('old'));
      const fresh = queue.enqueue(1, request('new'));
      await started;
      expect(queue.cancel(1, 'old')).toBe(true);
      expect(await stale).toBeInstanceOf(Error);
      expect(await active).toBeInstanceOf(Error);
      expect(await otherWindow).toBe(1);
      expect(await fresh).toBe(1);
      expect(calls).toBe(5);
      expect(queue.cancel(1, 'absent')).toBe(false);
    } finally {
      queue.stop();
    }
  });

  it('caps pending work, removes a destroyed owner and rejects all work on stop', async () => {
    const choose = vi.fn(
      (_value: BibleAiRequest, signal: AbortSignal) =>
        new Promise<number>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          }),
        ),
    );
    const queue = new ChooserQueue(choose);
    const active = queue
      .enqueue(1, request('a'))
      .catch((error: unknown) => error);
    const pending = Array.from({length: BIBLE_AI_LIMITS.pending}, () =>
      queue.enqueue(2, request('b')).catch((error: unknown) => error),
    );
    await expect(queue.enqueue(3, request('c'))).rejects.toThrow('limit');
    expect(queue.cancel(2)).toBe(true);
    expect(
      (await Promise.all(pending)).every(error => error instanceof Error),
    ).toBe(true);
    const last = queue
      .enqueue(3, request('c'))
      .catch((error: unknown) => error);
    queue.stop();
    expect(await active).toBeInstanceOf(Error);
    expect(await last).toBeInstanceOf(Error);
    await expect(queue.enqueue(3, request('c'))).rejects.toThrow('stopped');
  });
});
