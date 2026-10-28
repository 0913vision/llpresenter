import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Autosave} from './autosave';

const DELAY_MS = 500;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Autosave', () => {
  it('waits for one running file without waiting for an unrelated stalled save', async () => {
    const autosave = new Autosave(vi.fn(), DELAY_MS);
    let releaseCurrent: () => void = () => undefined;
    let releaseOther: () => void = () => undefined;
    autosave.schedule(
      'current',
      () =>
        new Promise<void>(resolve => {
          releaseCurrent = resolve;
        }),
    );
    autosave.schedule(
      'other',
      () =>
        new Promise<void>(resolve => {
          releaseOther = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    try {
      let currentIdle = false;
      const idle = autosave.idle('current').then(() => {
        currentIdle = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(currentIdle).toBe(false);
      releaseCurrent();
      await idle;
      expect(currentIdle).toBe(true);
    } finally {
      releaseCurrent();
      releaseOther();
      await autosave.flush();
      autosave.dispose();
    }
  });
  it('cancels a file pending explicit saving while retaining its running job and other files', async () => {
    let release: () => void = () => undefined;
    const autosave = new Autosave(vi.fn(), DELAY_MS);
    autosave.schedule(
      'current',
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    const due = vi.fn(async () => undefined);
    const waiting = vi.fn(async () => undefined);
    const other = vi.fn(async () => undefined);
    autosave.schedule('current', due);
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    autosave.schedule('current', waiting);
    autosave.schedule('other', other);
    autosave.cancelPending('current');
    let finished = false;
    const flushing = autosave.flush().then(() => {
      finished = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(finished).toBe(false);
    expect(other).toHaveBeenCalledOnce();
    release();
    await flushing;
    expect(due).not.toHaveBeenCalled();
    expect(waiting).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    autosave.dispose();
  });
  it('saves once, after the changes stop for the delay', async () => {
    const save = vi.fn(() => Promise.resolve());
    const autosave = new Autosave(vi.fn(), DELAY_MS);

    autosave.schedule('song-1', save);
    await vi.advanceTimersByTimeAsync(DELAY_MS - 100);
    autosave.schedule('song-1', save);
    await vi.advanceTimersByTimeAsync(DELAY_MS - 100);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves the latest change for each file', async () => {
    const saved: string[] = [];
    const autosave = new Autosave(vi.fn(), DELAY_MS);

    autosave.schedule('a', () => Promise.resolve(void saved.push('a1')));
    autosave.schedule('a', () => Promise.resolve(void saved.push('a2')));
    autosave.schedule('b', () => Promise.resolve(void saved.push('b1')));
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(saved.sort()).toEqual(['a2', 'b1']);
  });

  it('saves everything that waits when flushed, and waits for running saves', async () => {
    let finishRunning = (): void => undefined;
    const running = vi.fn(
      () => new Promise<void>(resolve => (finishRunning = resolve)),
    );
    const waiting = vi.fn(() => Promise.resolve());
    const autosave = new Autosave(vi.fn(), DELAY_MS);
    autosave.schedule('running', running);
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    autosave.schedule('waiting', waiting);
    let flushed = false;

    const flush = autosave.flush().then(() => {
      flushed = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(waiting).toHaveBeenCalledTimes(1);
    expect(flushed).toBe(false);
    finishRunning();
    await flush;

    expect(flushed).toBe(true);
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    expect(waiting).toHaveBeenCalledTimes(1);
  });

  it('runs one save per file while it stalls, then only the newest edit', async () => {
    let finishStalled = (): void => undefined;
    const stalled = vi.fn(
      () => new Promise<void>(resolve => (finishStalled = resolve)),
    );
    const edits = Array.from({length: 5}, () => vi.fn(() => Promise.resolve()));
    const autosave = new Autosave(vi.fn(), DELAY_MS);
    autosave.schedule('song-1', stalled);
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    for (const edit of edits) {
      autosave.schedule('song-1', edit);
      await vi.advanceTimersByTimeAsync(DELAY_MS);
    }
    expect(edits.map(edit => edit.mock.calls.length)).toEqual([0, 0, 0, 0, 0]);
    finishStalled();
    await vi.advanceTimersByTimeAsync(0);

    expect(stalled).toHaveBeenCalledTimes(1);
    expect(edits.map(edit => edit.mock.calls.length)).toEqual([0, 0, 0, 0, 1]);
  });

  it('waits on flush for a save that came due while another ran', async () => {
    let finishStalled = (): void => undefined;
    const stalled = vi.fn(
      () => new Promise<void>(resolve => (finishStalled = resolve)),
    );
    const latest = vi.fn(() => Promise.resolve());
    const autosave = new Autosave(vi.fn(), DELAY_MS);
    autosave.schedule('song-1', stalled);
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    autosave.schedule('song-1', latest);
    let flushed = false;

    const flush = autosave.flush().then(() => {
      flushed = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(flushed).toBe(false);
    finishStalled();
    await flush;

    expect(latest).toHaveBeenCalledTimes(1);
  });

  it.each(['same', 'other'])(
    'flushes a %s file scheduled while a save is running',
    async key => {
      let releaseFirst = (): void => undefined;
      let releaseLatest = (): void => undefined;
      const autosave = new Autosave(vi.fn(), DELAY_MS);
      autosave.schedule(
        'same',
        () =>
          new Promise<void>(resolve => {
            releaseFirst = resolve;
          }),
      );
      const flushing = autosave.flush();
      const latest = vi.fn(
        () =>
          new Promise<void>(resolve => {
            releaseLatest = resolve;
          }),
      );
      autosave.schedule(key, latest);
      let finished = false;
      const completed = flushing.then(() => {
        finished = true;
      });
      releaseFirst();
      await vi.advanceTimersByTimeAsync(0);
      expect(latest).toHaveBeenCalledOnce();
      expect(finished).toBe(false);
      releaseLatest();
      await completed;
      expect(finished).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      autosave.dispose();
    },
  );

  it('keeps the latest callback when a save reschedules another waiting file', async () => {
    const autosave = new Autosave(vi.fn(), DELAY_MS);
    const older = vi.fn(async () => undefined);
    const latest = vi.fn(async () => undefined);
    autosave.schedule('first', async () => {
      autosave.schedule('second', latest);
    });
    autosave.schedule('second', older);
    await autosave.flush();
    expect(older).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    autosave.dispose();
  });

  it('reports a save that fails and keeps going', async () => {
    const onError = vi.fn();
    const autosave = new Autosave(onError, DELAY_MS);
    const later = vi.fn(() => Promise.resolve());

    autosave.schedule('a', () => Promise.reject(new Error('disk full')));
    autosave.schedule('b', later);
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(onError).toHaveBeenCalledWith('a', new Error('disk full'));
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('drops waiting saves when disposed', async () => {
    const save = vi.fn(() => Promise.resolve());
    const autosave = new Autosave(vi.fn(), DELAY_MS);

    autosave.schedule('a', save);
    autosave.dispose();
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(save).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops a save that came due while another ran when disposed', async () => {
    let finishStalled = (): void => undefined;
    const due = vi.fn(() => Promise.resolve());
    const autosave = new Autosave(vi.fn(), DELAY_MS);
    autosave.schedule(
      'song-1',
      () => new Promise<void>(resolve => (finishStalled = resolve)),
    );
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    autosave.schedule('song-1', due);
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    autosave.dispose();
    finishStalled();
    await vi.advanceTimersByTimeAsync(0);

    expect(due).not.toHaveBeenCalled();
  });
});
