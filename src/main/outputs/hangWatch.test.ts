import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '../../../test/mock-clock';
import {ANSWER_LIMIT_MS, FRAME_SILENCE_MS, HangWatch} from './hangWatch';

const SECOND = 1000;

function setUp(answerAfterMs: number | null) {
  const clock = installMockClock();
  const ping = vi.fn(
    () =>
      new Promise<void>(resolve => {
        if (answerAfterMs !== null) setTimeout(resolve, answerAfterMs);
      }),
  );
  const onHung = vi.fn();
  const onSilentButAnswering = vi.fn();
  const watch = new HangWatch({ping, onHung, onSilentButAnswering});
  return {clock, ping, onHung, onSilentButAnswering, watch};
}

describe('HangWatch', () => {
  it('asks after the silence and calls a page that never answers hung', async () => {
    const {clock, ping, onHung, watch} = setUp(null);
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS - 1);
    expect(ping).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(ping).toHaveBeenCalledTimes(1);
    await clock.advance(ANSWER_LIMIT_MS - 1);
    expect(onHung).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(onHung).toHaveBeenCalledTimes(1);
  });

  it('starts over on every beat', async () => {
    const {clock, ping, watch} = setUp(null);
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS - 1);
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS - 1);
    expect(ping).not.toHaveBeenCalled();
  });

  it('never calls a slow page that answers within the limit hung', async () => {
    const {clock, onHung, watch} = setUp(ANSWER_LIMIT_MS - 1);
    watch.beat();
    await clock.advance(10 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(onHung).not.toHaveBeenCalled();
  });

  it('reports a page that answers but stays silent once, and keeps asking', async () => {
    const {clock, ping, onHung, onSilentButAnswering, watch} = setUp(0);
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS * 3 + SECOND);
    expect(ping).toHaveBeenCalledTimes(3);
    expect(onSilentButAnswering).toHaveBeenCalledTimes(1);
    expect(onHung).not.toHaveBeenCalled();
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS + SECOND);
    expect(onSilentButAnswering).toHaveBeenCalledTimes(2);
  });

  it('counts a failed ping as no answer', async () => {
    const clock = installMockClock();
    const onHung = vi.fn();
    const watch = new HangWatch({
      ping: () => Promise.reject(new Error('Object has been destroyed')),
      onHung,
      onSilentButAnswering: vi.fn(),
    });
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS + ANSWER_LIMIT_MS);
    expect(onHung).toHaveBeenCalledTimes(1);
  });

  it('ignores an answer that comes after the page was called hung', async () => {
    const {clock, onHung, onSilentButAnswering, watch} = setUp(
      ANSWER_LIMIT_MS + SECOND,
    );
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS + ANSWER_LIMIT_MS + 2 * SECOND);
    expect(onHung).toHaveBeenCalledTimes(1);
    expect(onSilentButAnswering).not.toHaveBeenCalled();
  });

  it('stays quiet once stopped, ignores a pending answer, and leaves no timer', async () => {
    const {clock, onHung, onSilentButAnswering, watch} = setUp(SECOND);
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS);
    watch.stop();
    await clock.advance(ANSWER_LIMIT_MS * 2);
    expect(onHung).not.toHaveBeenCalled();
    expect(onSilentButAnswering).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps one ping in flight through repeated retries and stops', async () => {
    const {clock, ping, onHung, watch} = setUp(null);
    onHung.mockImplementation(() => watch.beat());
    watch.beat();
    await clock.advance(5 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(onHung).toHaveBeenCalledTimes(5);
    watch.stop();
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS + ANSWER_LIMIT_MS);
    expect(onHung).toHaveBeenCalledTimes(6);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('takes a late answer to the ping in flight for a later question', async () => {
    const {clock, onHung, onSilentButAnswering, watch} = setUp(
      ANSWER_LIMIT_MS + FRAME_SILENCE_MS + SECOND,
    );
    onHung.mockImplementation(() => watch.beat());
    watch.beat();
    await clock.advance(2 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(onHung).toHaveBeenCalledTimes(1);
    expect(onSilentButAnswering).toHaveBeenCalledTimes(1);
  });

  it('pings a replaced page again', async () => {
    const {clock, ping, watch} = setUp(null);
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS);
    watch.pageReplaced();
    watch.beat();
    await clock.advance(FRAME_SILENCE_MS);
    expect(ping).toHaveBeenCalledTimes(2);
  });
});
